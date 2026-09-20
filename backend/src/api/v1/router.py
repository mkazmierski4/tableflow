from fastapi import APIRouter

from src.api.v1 import health, reservations, restaurants

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(restaurants.router)
api_router.include_router(reservations.router)
