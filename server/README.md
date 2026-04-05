# Operon API: Endpoint Summary

Below is the complete documentation for the travel agency backend.

---

## 1. User Identity (`/api/users`)

Manages traveler profiles and Instagram bot onboarding for personalized deals.

| Method | Endpoint        | Description            | Key Body/Params               |
|--------|----------------|------------------------|-------------------------------|
| POST   | /register      | Create or update user  | insta_tag, fullName, birthday |
| GET    | /:insta_tag    | Check if user exists   | insta_tag (URL Param)         |

---

## 2. Hotel Catalog (`/api/hotels`)

Manages physical stays, room inventory, and star ratings.

| Method | Endpoint | Description              | Key Body/Query                                                                 |
|--------|----------|--------------------------|---------------------------------------------------------------------------------|
| POST   | /        | Add a new hotel deal     | providerName, location, roomType, rating, startDate, endDate                   |
| GET    | /        | Search available hotels  | location, checkIn, checkOut, rating, amenities, minPrice, maxPrice             |

---

## 3. Flight Catalog (`/api/flights`)

Manages air travel routes, seat inventory, and airline metadata.

| Method | Endpoint | Description               | Key Body/Query                                                       |
|--------|----------|---------------------------|------------------------------------------------------------------------|
| POST   | /        | Add a new flight deal     | providerName (Airline), location (Destination), roomType (Class), inventory |
| GET    | /        | Search available flights  | location, checkIn (Departure Date), minPrice, maxPrice                |

---

## 4. Bookings & Transactions (`/api/bookings`)

The "connective tissue" linking users to specific travel assets across all categories.

| Method | Endpoint           | Description        | Key Body/Params                                   |
|--------|--------------------|--------------------|---------------------------------------------------|
| POST   | /                  | Create booking     | userId, itemId, itemModel ("Hotel" or "Flight")   |
| GET    | /                  | Admin view         | Returns every booking in the system               |
| GET    | /user/:userId      | User history       | Returns all trips and transactions for a specific user ID |

---