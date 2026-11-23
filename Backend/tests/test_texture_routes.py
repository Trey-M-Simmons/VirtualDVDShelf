import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

from database import get_connection
from main import app


async def request(path):
    messages = []
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [],
        "server": ("localhost", 8000),
        "client": ("localhost", 12345),
        "root_path": "",
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    await app(scope, receive, send)
    start = next(message for message in messages if message["type"] == "http.response.start")
    body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return start["status"], dict(start["headers"]), body


class TextureRoutesTests(unittest.TestCase):
    def setUp(self):
        self.texture_id = str(uuid4())
        self.row = {
            "texture_set_id": self.texture_id,
            "front_face": "front.png",
            "back_face": "nested/back.png",
            "spine": "https://example.com/spine.png",
        }
        self.connection = MagicMock()
        self.connection.execute.return_value.mappings.return_value.one_or_none.return_value = self.row
        app.dependency_overrides[get_connection] = lambda: self.connection
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.texture_dir = Path(self.directory.name)
        self.image = (Path(__file__).resolve().parents[1] / "textures" / "TestDBTexture.png").read_bytes()
        (self.texture_dir / "front.png").write_bytes(self.image)
        (self.texture_dir / "nested").mkdir()
        (self.texture_dir / "nested" / "back.png").write_bytes(self.image)
        self.directory_patch = patch("routes.texture_routes.TEXTURE_DIRECTORY", self.texture_dir)
        self.directory_patch.start()
        self.addCleanup(self.directory_patch.stop)
        self.addCleanup(app.dependency_overrides.pop, get_connection, None)

    def get(self, suffix=""):
        return asyncio.run(request(f"/api/textures/{self.texture_id}{suffix}"))

    def test_texture_set_returns_image_urls_and_binds_uuid(self):
        status, _, body = self.get()
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {
            "texture_set_id": self.texture_id,
            "front_face": f"http://localhost:8000/api/textures/{self.texture_id}/front_face",
            "back_face": f"http://localhost:8000/api/textures/{self.texture_id}/back_face",
            "spine": "https://example.com/spine.png",
        })
        statement, parameters = self.connection.execute.call_args.args
        self.assertEqual(set(statement._bindparams), {"texture_set_id"})
        self.assertEqual(parameters, {"texture_set_id": self.texture_id})

    def test_local_faces_return_image_bytes(self):
        for face in ("front_face", "back_face"):
            with self.subTest(face=face):
                status, headers, body = self.get(f"/{face}")
                self.assertEqual(status, 200)
                self.assertEqual(headers[b"content-type"], b"image/png")
                self.assertEqual(body, self.image)

    def test_external_face_redirects(self):
        status, headers, _ = self.get("/spine")
        self.assertEqual(status, 307)
        self.assertEqual(headers[b"location"], b"https://example.com/spine.png")

    def test_missing_and_invalid_values(self):
        self.connection.execute.return_value.mappings.return_value.one_or_none.return_value = None
        self.assertEqual(self.get()[0], 404)
        self.assertEqual(self.get("/front_face")[0], 404)
        self.assertEqual(asyncio.run(request("/api/textures/not-a-uuid"))[0], 422)
        self.assertEqual(self.get("/unknown")[0], 422)

    def test_missing_file_and_paths_outside_texture_directory(self):
        self.row["front_face"] = "missing.png"
        self.assertEqual(self.get("/front_face")[0], 404)
        for path in ("../outside.png", "/etc/passwd"):
            with self.subTest(path=path):
                self.row["front_face"] = path
                with self.assertLogs("routes.texture_routes", level="ERROR"):
                    self.assertEqual(self.get("/front_face")[0], 500)

    def test_symlink_cannot_escape_texture_directory(self):
        outside = self.texture_dir.parent / "outside.png"
        (self.texture_dir / "outside-link").symlink_to(outside)
        self.row["front_face"] = "outside-link"
        with self.assertLogs("routes.texture_routes", level="ERROR"):
            self.assertEqual(self.get("/front_face")[0], 500)

    def test_database_errors_are_not_hidden(self):
        self.connection.execute.side_effect = RuntimeError("database unavailable")
        with self.assertRaisesRegex(RuntimeError, "database unavailable"):
            self.get()


if __name__ == "__main__":
    unittest.main()
