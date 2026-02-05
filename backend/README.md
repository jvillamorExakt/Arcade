# Arcade Backend API

## Run

```bash
cd "C:\Users\Exakt Medical 48\Documents\Arcade"
npm run start
```

Health check: `GET http://localhost:3001/health`

## Env

`backend/.env`:

```
FIREBASE_SERVICE_ACCOUNT="C:/Users/Exakt Medical 48/Documents/Arcade/backend/exakt-arcade-firebase-adminsdk-fbsvc-43a2412e20.json"
FIREBASE_PROJECT_ID="exakt-arcade"
FIREBASE_WEB_API_KEY="YOUR_FIREBASE_WEB_API_KEY"
FIREBASE_STORAGE_BUCKET="exakt-arcade.firebasestorage.app"
```

## Account creation (connected to users)

Create a Firebase Auth user and a matching Firestore `users/{userId}` doc.

`POST /api/auth/register`

Request body:
```
{
  "username": "angelobagasbas",
  "fullName": "Angelo Bagasbas",
  "password": "12345678",
  "role": "quester",
  "departmentId": "dept-engineering",
  "categoryIds": ["cat-backend"]
}
```

Response:
```
{
  "userId": "user-0010",
  "email": "angelo.bagasbas.user-0010@exakt-arcade.local",
  "name": "Angelo Bagasbas",
  "role": "quester"
}
```

Notes:
- `userId` format is always `user-0000` (four digits).
- `role` must be `quester`, `questmaster`, or `superadmin`.
- For `questmaster` and `superadmin`, level/points remain at 0.
- If `email` is not provided, a local email is generated automatically.
- Firebase Auth **Email/Password** provider must be enabled for Auth creation.
- `username` is used for login and stored in Firestore.

## Login (connected to users)

`POST /api/auth/login`

Request body:
```
{
  "identifier": "user-0001",
  "password": "12345678"
}
```

`identifier` can be the username, userId (`user-0001`), or an email address.

Response:
```
{
  "userId": "user-0001",
  "email": "quester1@exakt-arcade.local",
  "name": "Quester One",
  "idToken": "<firebase-id-token>",
  "refreshToken": "<firebase-refresh-token>",
  "profile": { "id": "user-0001", "name": "Quester One", "...": "..." }
}
```

## Auth-protected endpoints

All `/api/*` routes (except `/api/auth/*`) now require:

`Authorization: Bearer <idToken>`

## Image upload (Firebase Storage)

`POST /api/uploads` (auth required)

Form-data:
- `image` (file)

Response:
```
{
  "bucket": "exakt-arcade.firebasestorage.app",
  "path": "uploads/user-0001/1700000000000-<token>.png",
  "downloadUrl": "https://firebasestorage.googleapis.com/v0/b/..."
}
```

Use `downloadUrl` for `imageUrl` fields on `quests`, `bonusQuests`, `rewardPools`, and `rewards`.

## CRUD API

All endpoints are under `/api`.

### Users
- `GET /users`
- `GET /users/:userId`
- `POST /users`
- `PUT /users/:userId`
- `PATCH /users/:userId`
- `DELETE /users/:userId`

Subcollections:
- `GET /users/:userId/questAttempts`
- `GET /users/:userId/questAttempts/:id`
- `POST /users/:userId/questAttempts`
- `PUT /users/:userId/questAttempts/:id`
- `PATCH /users/:userId/questAttempts/:id`
- `DELETE /users/:userId/questAttempts/:id`

- `GET /users/:userId/attendanceLogs`
- `GET /users/:userId/attendanceLogs/:id`
- `POST /users/:userId/attendanceLogs`
- `PUT /users/:userId/attendanceLogs/:id`
- `PATCH /users/:userId/attendanceLogs/:id`
- `DELETE /users/:userId/attendanceLogs/:id`

- `GET /users/:userId/transactions`
- `GET /users/:userId/transactions/:id`
- `POST /users/:userId/transactions`
- `PUT /users/:userId/transactions/:id`
- `PATCH /users/:userId/transactions/:id`
- `DELETE /users/:userId/transactions/:id`

### Departments and categories
- `GET /departments`
- `GET /departments/:departmentId`
- `POST /departments`
- `PUT /departments/:departmentId`
- `PATCH /departments/:departmentId`
- `DELETE /departments/:departmentId`

Categories:
- `GET /departments/:departmentId/categories`
- `GET /departments/:departmentId/categories/:id`
- `POST /departments/:departmentId/categories`
- `PUT /departments/:departmentId/categories/:id`
- `PATCH /departments/:departmentId/categories/:id`
- `DELETE /departments/:departmentId/categories/:id`

### Quests
- `GET /quests`
- `GET /quests/:id`
- `POST /quests`
- `PUT /quests/:id`
- `PATCH /quests/:id`
- `DELETE /quests/:id`

### Bonus quests
- `GET /bonusQuests`
- `GET /bonusQuests/:id`
- `POST /bonusQuests`
- `PUT /bonusQuests/:id`
- `PATCH /bonusQuests/:id`
- `DELETE /bonusQuests/:id`

### Help requests
- `GET /helpRequests`
- `GET /helpRequests/:id`
- `POST /helpRequests`
- `PUT /helpRequests/:id`
- `PATCH /helpRequests/:id`
- `DELETE /helpRequests/:id`

### Levels
- `GET /levels`
- `GET /levels/:id`
- `POST /levels`
- `PUT /levels/:id`
- `PATCH /levels/:id`
- `DELETE /levels/:id`

### Reward pools
- `GET /rewardPools`
- `GET /rewardPools/:id`
- `POST /rewardPools`
- `PUT /rewardPools/:id`
- `PATCH /rewardPools/:id`
- `DELETE /rewardPools/:id`

### Rewards
- `GET /rewards`
- `GET /rewards/:id`
- `POST /rewards`
- `PUT /rewards/:id`
- `PATCH /rewards/:id`
- `DELETE /rewards/:id`

### Attendance config
- `GET /attendanceConfig`
- `GET /attendanceConfig/:id`
- `POST /attendanceConfig`
- `PUT /attendanceConfig/:id`
- `PATCH /attendanceConfig/:id`
- `DELETE /attendanceConfig/:id`

### Economy config
- `GET /economyConfig`
- `GET /economyConfig/:id`
- `POST /economyConfig`
- `PUT /economyConfig/:id`
- `PATCH /economyConfig/:id`
- `DELETE /economyConfig/:id`

### Conversion requests
- `GET /conversionRequests`
- `GET /conversionRequests/:id`
- `POST /conversionRequests`
- `PUT /conversionRequests/:id`
- `PATCH /conversionRequests/:id`
- `DELETE /conversionRequests/:id`

### Deduction configs
- `GET /deductionConfigs`
- `GET /deductionConfigs/:id`
- `POST /deductionConfigs`
- `PUT /deductionConfigs/:id`
- `PATCH /deductionConfigs/:id`
- `DELETE /deductionConfigs/:id`
