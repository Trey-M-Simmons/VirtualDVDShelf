import logging
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_connection
from models import TextureSet

# An APIRouter groups related endpoints. main.py adds the /api/textures prefix
# to every path registered on this router.
router = APIRouter()
logger = logging.getLogger(__name__)
# Local texture paths in the database are relative to this directory.
TEXTURE_DIRECTORY = Path(__file__).resolve().parents[1] / "textures"
# FastAPI uses this list to reject unsupported face names with a 422 response.
TextureFace = Literal["front_face", "back_face", "spine"]

# The placeholder is supplied separately when executing the query, rather than
# inserting user input into the SQL string. PostgreSQL stores the ID as a UUID.
TEXTURE_SELECT = """
    SELECT t.texture_set_id::text AS texture_set_id,
           t.front_face,
           t.back_face,
           t.spine
    FROM texture_sets AS t
    WHERE t.texture_set_id = CAST(:texture_set_id AS uuid)
"""


def load_texture_set(texture_set_id: UUID, connection: Connection) -> TextureSet:
    # Both endpoints need the same database row. mappings() lets us access its
    # columns by name; one_or_none() returns None if no row matches.
    row = connection.execute(
        text(TEXTURE_SELECT), {"texture_set_id": str(texture_set_id)}
    ).mappings().one_or_none()
    if row is None:
        # HTTPException tells FastAPI to return an HTTP error to the client.
        raise HTTPException(status_code=404, detail="Texture set not found")
    # Build the response model using the column names and values from the row.
    return TextureSet(**row)


def is_external_url(value: str) -> bool:
    # Only complete HTTP(S) URLs are returned directly or used as redirect targets.
    url = urlsplit(value)
    return url.scheme.lower() in ("http", "https") and bool(url.netloc)


# GET /api/textures/{texture_set_id} returns JSON describing one texture set.
# The braces identify a path parameter supplied by the client. FastAPI checks
# that it is a UUID and returns 422 if the supplied value is invalid.
# response_model validates and documents the JSON fields in the response.
@router.get("/{texture_set_id}", response_model=TextureSet)
def get_texture_set(
    texture_set_id: UUID, request: Request, connection: Connection = Depends(get_connection)
):
    # Depends asks FastAPI to supply a database connection for this request.
    # Request is supplied by FastAPI and is used below to build image URLs.
    texture_set = load_texture_set(texture_set_id, connection)
    # Return URLs, not image bytes, in the JSON. For a local file, url_for
    # builds a link to the named image endpoint; external URLs stay unchanged.
    for face in ("front_face", "back_face", "spine"):
        if not is_external_url(getattr(texture_set, face)):
            setattr(texture_set, face, str(request.url_for(
                "get_texture_face", texture_set_id=str(texture_set_id), face=face
            )))
    return texture_set


# GET /api/textures/{texture_set_id}/{face} returns one image. For example,
# the face can be front_face, back_face, or spine. The route name also lets
# the endpoint above construct links to it without hard-coding the full URL.
@router.get("/{texture_set_id}/{face}", name="get_texture_face")
def get_texture_face(
    texture_set_id: UUID, face: TextureFace, connection: Connection = Depends(get_connection)
):
    texture_set = load_texture_set(texture_set_id, connection)
    value = getattr(texture_set, face)#gets a specific face/texture from 
    if is_external_url(value):
        # Ask the client to fetch the image from the external URL instead.
        return RedirectResponse(value)

    # For local images, resolve symlinks and reject absolute paths or paths
    # that escape the texture directory, so unrelated files cannot be served.
    root = TEXTURE_DIRECTORY.resolve()
    path = (root / value).resolve()
    if not value or Path(value).is_absolute() or not path.is_relative_to(root):
        logger.error("Invalid local texture path for texture set %s, face %s", texture_set_id, face)
        raise HTTPException(status_code=500, detail="Invalid texture path")
    if not path.is_file():
        # The set exists, but its local image file is missing.
        raise HTTPException(status_code=404, detail="Texture file not found")
    # FastAPI sends the file contents as the HTTP response, with a media type
    # inferred from the filename (for example, image/png for a .png file).
    return FileResponse(path)