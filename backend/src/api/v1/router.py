from fastapi import APIRouter

from src.api.v1 import auth, health, reservations, restaurants, tables, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(restaurants.router)
api_router.include_router(tables.router)
api_router.include_router(reservations.router)
