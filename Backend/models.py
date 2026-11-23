from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

class CreateAccountRequest(BaseModel):
    username: str

class AccountResponse(BaseModel):
    username: str

class AddExistingDVDRequest(BaseModel):
    username: str
    dvd_id: UUID
    texture_set_id: UUID

class TextureSet(BaseModel):
    texture_set_id: str
    front_face: str
    back_face: str
    spine: str

class DVD(BaseModel):
    dvd_id: str
    title: str
    actors: List[str]
    directors: List[str]
    description: str
    texture_set_ids: List[str]

class DVDResponse(BaseModel):
    dvd_id: str
    title: str
    actors: List[str]
    directors: List[str]
    description: str
    texture_set_ids: List[str]
