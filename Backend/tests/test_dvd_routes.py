import asyncio
import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch
from uuid import UUID, uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from database import create_database_engine
from main import app
from test_texture_routes import request as texture_request


async def request(path, method="GET", body=b"", headers=None):
    messages = []
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers or [],
        "server": ("localhost", 8000),
        "client": ("localhost", 12345),
        "root_path": "",
    }

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    await app(scope, receive, send)
    status = next(message["status"] for message in messages if message["type"] == "http.response.start")
    body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return status, json.loads(body) if body else None


def add_request(fields, images):
    boundary = "dvd-test-boundary"
    parts = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'
            f'{value}\r\n'.encode()
        )
    for name, (filename, content) in images.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; '
            f'filename="{filename}"\r\nContent-Type: image/png\r\n\r\n'.encode()
            + content + b"\r\n"
        )
    body = b"".join(parts) + f"--{boundary}--\r\n".encode()
    return asyncio.run(request(
        "/api/dvds/addDVD", "POST", body,
        [(b"content-type", f"multipart/form-data; boundary={boundary}".encode())],
    ))


@unittest.skipUnless(os.environ.get("RUN_DATABASE_TESTS") == "1", "set RUN_DATABASE_TESTS=1")
class DVDRoutesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = "dvd_test_" + uuid4().hex
        cls.admin_engine = create_database_engine()
        with cls.admin_engine.begin() as connection:
            connection.exec_driver_sql(f'CREATE SCHEMA "{cls.schema}"')
        try:
            cls.engine = create_engine(
                cls.admin_engine.url,
                connect_args={"options": f"-csearch_path={cls.schema}"},
            )
            schema = (Path(__file__).resolve().parents[1] / "DB" / "schema.sql").read_text()
            with cls.engine.begin() as connection:
                connection.exec_driver_sql(schema)
        except Exception:
            with cls.admin_engine.begin() as connection:
                connection.exec_driver_sql(f'DROP SCHEMA "{cls.schema}" CASCADE')
            cls.admin_engine.dispose()
            raise
        app.state.db_engine = cls.engine

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        with cls.admin_engine.begin() as connection:
            connection.exec_driver_sql(f'DROP SCHEMA "{cls.schema}" CASCADE')
        cls.admin_engine.dispose()

    def setUp(self):
        with self.engine.begin() as connection:
            connection.execute(text("DELETE FROM dvds"))
            connection.execute(text("DELETE FROM accounts"))

    def setup_upload(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        patcher = patch("routes.texture_routes.TEXTURE_DIRECTORY", Path(directory.name))
        patcher.start()
        self.addCleanup(patcher.stop)
        with self.engine.begin() as connection:
            connection.execute(text("INSERT INTO accounts (username) VALUES ('alice')"))
        image = (Path(__file__).resolve().parents[1] / "textures" / "TestDBTexture.png").read_bytes()
        fields = {
            "username": "alice", "title": "Example", "actors": '["Actor B", "Actor A"]',
            "directors": '["Director"]', "description": "Description",
        }
        images = {face: (f"{face}.png", image) for face in ("front_face", "back_face", "spine")}
        return Path(directory.name), fields, images

    def test_account_creation_listing_and_validation(self):
        def create(username):
            body = json.dumps({"username": username}).encode()
            return asyncio.run(request("/api/accounts/", "POST", body,
                                       [(b"content-type", b"application/json")]))

        self.assertEqual(asyncio.run(request("/api/accounts/")), (200, []))
        for username in ("", "   ", "a/b", "a b", "a" * 65):
            with self.subTest(username=username):
                self.assertEqual(create(username)[0], 422)
        self.assertEqual(create(" Alice_1 "), (201, {"username": "Alice_1"}))
        self.assertEqual(create("Alice_1"), (409, {"detail": "Username already exists"}))
        self.assertEqual(create("bob-2"), (201, {"username": "bob-2"}))
        self.assertEqual(asyncio.run(request("/api/accounts/")),
                         (200, [{"username": "Alice_1"}, {"username": "bob-2"}]))
        self.assertEqual(asyncio.run(request("/api/dvds/user/Alice_1")), (200, []))

    def test_concurrent_account_creation(self):
        body = json.dumps({"username": "alice"}).encode()
        def post(_):
            return asyncio.run(request("/api/accounts/", "POST", body,
                                       [(b"content-type", b"application/json")]))[0]
        with ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(sorted(executor.map(post, range(2))), [201, 409])

    def test_add_existing_dvd_validates_and_selects_texture(self):
        dvd_id, other_id, first, second, unrelated = (str(uuid4()) for _ in range(5))
        with self.engine.begin() as connection:
            connection.execute(text("INSERT INTO accounts (username) VALUES ('alice'), ('bob')"))
            connection.execute(text(
                "INSERT INTO dvds (dvd_id, title, actors, directors) VALUES "
                "(:dvd, 'Example', ARRAY['Actor'], ARRAY['Director']), (:other, 'Other', '{}', '{}')"
            ), {"dvd": dvd_id, "other": other_id})
            connection.execute(text(
                "INSERT INTO texture_sets (texture_set_id, dvd_id, front_face, back_face, spine) VALUES "
                "(:first, :dvd, 'a', 'b', 'c'), (:second, :dvd, 'd', 'e', 'f'), "
                "(:unrelated, :other, 'g', 'h', 'i')"
            ), {"dvd": dvd_id, "other": other_id, "first": first, "second": second, "unrelated": unrelated})

        def post(username, dvd, texture):
            body = json.dumps({"username": username, "dvd_id": dvd, "texture_set_id": texture}).encode()
            return asyncio.run(request("/api/dvds/addExistingDVD", "POST", body,
                                       [(b"content-type", b"application/json")]))

        self.assertEqual(post("missing", dvd_id, first)[0], 404)
        self.assertEqual(post("alice", dvd_id, unrelated)[0], 404)
        self.assertEqual(post("alice", str(uuid4()), first)[0], 404)
        self.assertEqual(post("alice", "invalid", first)[0], 422)
        status, dvd = post("alice", dvd_id, second)
        self.assertEqual(status, 201)
        self.assertEqual(dvd["texture_set_ids"], [second])
        self.assertEqual(asyncio.run(request("/api/dvds/user/alice")), (200, [dvd]))
        self.assertEqual(post("alice", dvd_id, first), (409, {"detail": "DVD is already on this shelf"}))
        self.assertEqual(asyncio.run(request("/api/dvds/user/alice")), (200, [dvd]))
        self.assertEqual(post("bob", dvd_id, first)[0], 201)
        self.assertEqual(asyncio.run(request("/api/dvds/user/bob"))[1][0]["texture_set_ids"], [first])

    def test_concurrent_add_existing_dvd_only_inserts_once(self):
        dvd_id, texture_id = str(uuid4()), str(uuid4())
        with self.engine.begin() as connection:
            connection.execute(text("INSERT INTO accounts (username) VALUES ('alice')"))
            connection.execute(text("INSERT INTO dvds (dvd_id, title) VALUES (:id, 'Example')"), {"id": dvd_id})
            connection.execute(text(
                "INSERT INTO texture_sets (texture_set_id, dvd_id, front_face, back_face, spine) "
                "VALUES (:texture, :dvd, 'a', 'b', 'c')"
            ), {"texture": texture_id, "dvd": dvd_id})
        body = json.dumps({"username": "alice", "dvd_id": dvd_id, "texture_set_id": texture_id}).encode()
        def post(_):
            return asyncio.run(request("/api/dvds/addExistingDVD", "POST", body,
                                       [(b"content-type", b"application/json")]))[0]
        with ThreadPoolExecutor(max_workers=2) as executor:
            self.assertEqual(sorted(executor.map(post, range(2))), [201, 409])

    def test_remove_dvd_only_from_requested_account(self):
        dvd_id, texture_id = str(uuid4()), str(uuid4())
        with self.engine.begin() as connection:
            connection.execute(text("INSERT INTO accounts (username) VALUES ('alice'), ('bob')"))
            connection.execute(text("INSERT INTO dvds (dvd_id, title) VALUES (:id, 'Example')"), {"id": dvd_id})
            connection.execute(text(
                "INSERT INTO texture_sets (texture_set_id, dvd_id, front_face, back_face, spine) "
                "VALUES (:texture, :dvd, 'a', 'b', 'c')"
            ), {"texture": texture_id, "dvd": dvd_id})
            connection.execute(text(
                "INSERT INTO account_dvds (user_id, dvd_id, texture_set_id) "
                "SELECT user_id, :dvd, :texture FROM accounts"
            ), {"texture": texture_id, "dvd": dvd_id})

        self.assertEqual(asyncio.run(request(f"/api/dvds/user/missing/{dvd_id}", "DELETE"))[0], 404)
        self.assertEqual(asyncio.run(request("/api/dvds/user/alice/not-a-uuid", "DELETE"))[0], 422)
        self.assertEqual(asyncio.run(request(f"/api/dvds/user/alice/{dvd_id}", "DELETE")), (204, None))
        self.assertEqual(asyncio.run(request(f"/api/dvds/user/alice/{dvd_id}", "DELETE"))[0], 404)
        self.assertEqual(asyncio.run(request("/api/dvds/user/alice")), (200, []))
        self.assertEqual(asyncio.run(request("/api/dvds/user/bob"))[1][0]["texture_set_ids"], [texture_id])
        self.assertEqual(asyncio.run(request(f"/api/dvds/{dvd_id}"))[1]["texture_set_ids"], [texture_id])
        with self.engine.begin() as connection:
            self.assertEqual(connection.execute(text(
                "SELECT COUNT(*) FROM texture_sets WHERE texture_set_id = :texture"
            ), {"texture": texture_id}).scalar_one(), 1)

    def test_add_dvd_uploads_and_assigns_to_user(self):
        directory, fields, images = self.setup_upload()
        status, dvd = add_request(fields, images)
        self.assertEqual(status, 201)
        UUID(dvd["dvd_id"])
        texture_id = dvd["texture_set_ids"][0]
        UUID(texture_id)
        self.assertEqual(dvd["title"], fields["title"])
        self.assertEqual(dvd["actors"], ["Actor B", "Actor A"])
        self.assertEqual(dvd["directors"], ["Director"])
        self.assertEqual(dvd["description"], "Description")
        self.assertEqual(asyncio.run(request(f"/api/dvds/{dvd['dvd_id']}")), (200, dvd))
        self.assertEqual(asyncio.run(request("/api/dvds/user/alice")), (200, [dvd]))
        for face, (_, image) in images.items():
            self.assertEqual((directory / "uploads" / texture_id / f"{face}.png").read_bytes(), image)
            status, headers, body = asyncio.run(texture_request(f"/api/textures/{texture_id}/{face}"))
            self.assertEqual((status, headers[b"content-type"], body), (200, b"image/png", image))

    def test_duplicate_identity_is_normalized_and_rolls_back(self):
        directory, fields, images = self.setup_upload()
        self.assertEqual(add_request(fields, images)[0], 201)
        fields.update(title="  EXAMPLE\t", actors='[" actor a ", "ACTOR B"]',
                      directors='["director"]', description="Different")
        self.assertEqual(add_request(fields, images), (409, {"detail": "DVD already exists"}))
        self.assertEqual(len(list((directory / "uploads").iterdir())), 1)
        fields["directors"] = '["Another director"]'
        self.assertEqual(add_request(fields, images)[0], 201)
        fields["directors"] = '["director"]'
        fields["actors"] = '["Another actor"]'
        self.assertEqual(add_request(fields, images)[0], 201)

    def test_concurrent_duplicates_only_create_one_dvd(self):
        directory, fields, images = self.setup_upload()
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: add_request(fields, images), range(2)))
        self.assertEqual(sorted(status for status, _ in results), [201, 409])
        self.assertEqual(len(list((directory / "uploads").iterdir())), 1)
        self.assertEqual(len(asyncio.run(request("/api/dvds/user/alice"))[1]), 1)

    def test_invalid_uploads_and_missing_user_leave_no_data(self):
        directory, fields, images = self.setup_upload()
        fields["username"] = "missing"
        self.assertEqual(add_request(fields, images)[0], 404)
        fields["username"] = "alice"
        fields["actors"] = "not json"
        self.assertEqual(add_request(fields, images)[0], 422)
        fields["actors"] = '["Actor"]'
        images["back_face"] = ("back.png", b"")
        self.assertEqual(add_request(fields, images)[0], 422)
        images["back_face"] = ("back.txt", b"not an image")
        self.assertEqual(add_request(fields, images)[0], 422)
        self.assertEqual(list((directory / "uploads").iterdir()), [])
        self.assertEqual(asyncio.run(request("/api/dvds/")), (200, []))
        self.assertEqual(asyncio.run(request("/api/dvds/user/alice")), (200, []))

    def test_file_write_error_rolls_back_database_and_files(self):
        directory, fields, images = self.setup_upload()
        with patch("routes.dvd_routes.shutil.copyfileobj", side_effect=OSError("disk error")):
            with self.assertRaisesRegex(OSError, "disk error"):
                add_request(fields, images)
        self.assertEqual(list((directory / "uploads").iterdir()), [])
        self.assertEqual(asyncio.run(request("/api/dvds/")), (200, []))
        self.assertEqual(asyncio.run(request("/api/dvds/user/alice")), (200, []))

    def test_duplicate_identity_migration_requires_existing_duplicates_to_be_resolved(self):
        with self.engine.begin() as connection:
            connection.exec_driver_sql("DROP INDEX dvds_identity_idx")
            connection.exec_driver_sql("DROP FUNCTION dvd_normalize_names(text[])")
            connection.exec_driver_sql("DROP FUNCTION dvd_normalize_text(text)")
            connection.execute(text(
                "INSERT INTO dvds (title, actors, directors) VALUES "
                "('Example', ARRAY['A', 'B'], ARRAY['D']), "
                "(' example ', ARRAY['b', 'a'], ARRAY['d'])"
            ))
        migration = (Path(__file__).resolve().parents[1] / "DB" / "migrations" /
                     "003_unique_dvd_identity.sql").read_text()
        try:
            with self.assertRaises(IntegrityError):
                with self.engine.connect() as connection:
                    connection.exec_driver_sql(migration)
            with self.engine.begin() as connection:
                connection.execute(text("DELETE FROM dvds WHERE title = ' example '"))
            with self.engine.connect() as connection:
                connection.exec_driver_sql(migration)
            with self.assertRaises(IntegrityError):
                with self.engine.begin() as connection:
                    connection.execute(text(
                        "INSERT INTO dvds (title, actors, directors) "
                        "VALUES (' example ', ARRAY['b', 'a'], ARRAY['d'])"
                    ))
        finally:
            # Restore the shared test schema even if an assertion fails.
            with self.engine.begin() as connection:
                connection.execute(text("DELETE FROM dvds"))
                connection.exec_driver_sql("DROP INDEX IF EXISTS dvds_identity_idx")
                connection.exec_driver_sql("DROP FUNCTION IF EXISTS dvd_normalize_names(text[])")
                connection.exec_driver_sql("DROP FUNCTION IF EXISTS dvd_normalize_text(text)")
            with self.engine.connect() as connection:
                connection.exec_driver_sql(migration)

    def test_empty_and_missing(self):
        self.assertEqual(asyncio.run(request("/api/dvds/")), (200, []))
        self.assertEqual(asyncio.run(request(f"/api/dvds/{uuid4()}"))[0], 404)
        self.assertEqual(asyncio.run(request("/api/dvds/not-a-uuid"))[0], 422)

    def test_dvds_and_texture_ids(self):
        dvd_id, empty_id, first, second = (str(uuid4()) for _ in range(4))
        with self.engine.begin() as connection:
            connection.execute(
                text("INSERT INTO dvds (dvd_id, title, actors, directors, description) "
                     "VALUES (:id, 'Example', ARRAY['Actor'], ARRAY['Director'], 'Description'), "
                     "(:empty_id, 'No textures', ARRAY[]::text[], ARRAY[]::text[], '')"),
                {"id": dvd_id, "empty_id": empty_id},
            )
            connection.execute(
                text("INSERT INTO texture_sets (texture_set_id, dvd_id, front_face, back_face, spine) "
                     "VALUES (:first, :id, 'front', 'back', 'spine'), "
                     "(:second, :id, 'front2', 'back2', 'spine2')"),
                {"first": first, "second": second, "id": dvd_id},
            )
        status, dvd = asyncio.run(request(f"/api/dvds/{dvd_id}"))
        self.assertEqual(status, 200)
        self.assertEqual(dvd, {
            "dvd_id": dvd_id, "title": "Example", "actors": ["Actor"],
            "directors": ["Director"], "description": "Description",
            "texture_set_ids": sorted([first, second]),
        })
        status, dvds = asyncio.run(request("/api/dvds/"))
        self.assertEqual(status, 200)
        self.assertEqual(dvds[0], dvd)
        self.assertEqual(dvds[1]["texture_set_ids"], [])
        status, texture = asyncio.run(request(f"/api/textures/{first}"))
        self.assertEqual(status, 200)
        self.assertEqual(texture, {
            "texture_set_id": first,
            "front_face": f"http://localhost:8000/api/textures/{first}/front_face",
            "back_face": f"http://localhost:8000/api/textures/{first}/back_face",
            "spine": f"http://localhost:8000/api/textures/{first}/spine",
        })

    def test_user_dvds_include_only_each_users_selected_texture(self):
        dvd_id, other_dvd, first, second, other_texture, alice, bob = (
            str(uuid4()) for _ in range(7)
        )
        with self.engine.begin() as connection:
            connection.execute(
                text("INSERT INTO dvds (dvd_id, title) VALUES (:id, 'Example'), "
                     "(:other, 'Other')"),
                {"id": dvd_id, "other": other_dvd},
            )
            connection.execute(
                text("INSERT INTO texture_sets (texture_set_id, dvd_id, front_face, back_face, spine) "
                     "VALUES (:first, :id, 'front', 'back', 'spine'), "
                     "(:second, :id, 'front', 'back', 'spine'), "
                     "(:other_texture, :other, 'front', 'back', 'spine')"),
                {"first": first, "second": second, "id": dvd_id,
                 "other_texture": other_texture, "other": other_dvd},
            )
            connection.execute(
                text("INSERT INTO accounts (user_id, username) VALUES "
                     "(:alice, 'alice'), (:bob, 'bob'), (:empty, 'empty')"),
                {"alice": alice, "bob": bob, "empty": str(uuid4())},
            )
            connection.execute(
                text("INSERT INTO account_dvds (user_id, dvd_id, texture_set_id) VALUES "
                     "(:alice, :id, :first), (:bob, :id, :second), "
                     "(:bob, :other, :other_texture)"),
                {"alice": alice, "bob": bob, "id": dvd_id, "first": first,
                 "second": second, "other": other_dvd, "other_texture": other_texture},
            )

        status, alice_dvds = asyncio.run(request("/api/dvds/user/alice"))
        self.assertEqual(status, 200)
        self.assertEqual(alice_dvds, [{
            "dvd_id": dvd_id, "title": "Example", "actors": [], "directors": [],
            "description": "", "texture_set_ids": [first],
        }])
        status, bob_dvds = asyncio.run(request("/api/dvds/user/bob"))
        self.assertEqual(status, 200)
        self.assertEqual([dvd["dvd_id"] for dvd in bob_dvds], [dvd_id, other_dvd])
        self.assertEqual([dvd["texture_set_ids"] for dvd in bob_dvds],
                         [[second], [other_texture]])
        self.assertEqual(asyncio.run(request("/api/dvds/user/empty")), (200, []))
        self.assertEqual(asyncio.run(request("/api/dvds/user/missing")), (200, []))
        self.assertEqual(
            asyncio.run(request(f"/api/dvds/{dvd_id}"))[1]["texture_set_ids"],
            sorted([first, second]),
        )


if __name__ == "__main__":
    unittest.main()
