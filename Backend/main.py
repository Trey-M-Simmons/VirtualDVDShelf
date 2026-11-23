from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_database_engine
from routes.dvd_routes import router as dvd_router
from routes.texture_routes import router as texture_router
from routes.account_routes import router as account_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = create_database_engine()
    app.state.db_engine = engine
    try:
        yield
    finally:
        engine.dispose()


app = FastAPI(
    title="Virtual DVD Shelf API",
    description="API for managing virtual DVD shelf",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(dvd_router, prefix="/api/dvds", tags=["DVDs"])

# Include textures routers
app.include_router(texture_router, prefix="/api/textures", tags=["Textures"])
app.include_router(account_router, prefix="/api/accounts", tags=["Accounts"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Virtual DVD Shelf API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
