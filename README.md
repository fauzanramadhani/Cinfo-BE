# Cinfo BE

Server for the Cinfo application, this server was built using Websocket technology by utilizing the Socket.Io library and also this server uses conventional HTTP Requests for several APIs

---

### Realtime 1

#### Description

`This api is supposed to be used by admin`

#### Event

`room`

#### Message

`-`

#### Response

```json
{
  "_id": "6626483efa600550d677b8e0",
  "room_name": "Teknik Informatika",
  "additional": "Angkatan 3",
  "client_offset": 2,
  "createdAt": 1713784894417,
  "post_id": ["66264872fa600550d677b8e1", "66264891fa600550d677b8e2"]
}
```

---

### Realtime 2

#### Description

`This api is supposed to be used by admin`

#### Event

`createRoom`

#### Message

```json
{
  "room_name": "Teknik Informatika",
  "additional": "Angkatan 3"
}
```

#### Response

if success event `room` will be triggered with the new value

---

### Realtime 3

#### Description

`This api is supposed to be used by admin`

#### Event

`editRoom`

#### Message

```json
{
  "room_id": "662645acb3c221d33c039365",
  "room_name": "Teknik Informatika",
  "additional": "Angkatan 1"
}
```

#### Response

if success event `room` will be triggered with the new value

---

### Realtime 4

#### Description

`This api is supposed to be used by admin`

#### Event

`deleteRoom`

#### Message

```json
{
  "room_id": "662e78514f1c1456f7e8ad50"
}
```

#### Response

if success event `onDeleteRoom` and `${user_id}-on-room-update` will be triggered with the new value

---

### Realtime 5

#### Description

`This api is supposed to be used by admin`

#### Event

`onDeleteRoom`

#### Message

`-`

#### Response

`${deleted_room_id}`

---

### Realtime 6

#### Description

`This api is supposed to be used by admin`

#### Event

`addMember`

#### Message

```json
{
  "email": "fauzanramadhani06@gmail.com",
  "room_id": "662e78514f1c1456f7e8ad50"
}
```

#### Response

if success event `${room_id}-member` and `${user_id}-on-room-update` will be triggered with the new value

---

### Realtime 7

#### Description

`This api is supposed to be used by admin`

#### Event

`deleteMember`

#### Message

```json
{
  "member_id": "662e724ecc633415df745553",
  "room_id": "662e78514f1c1456f7e8ad50"
}
```

#### Response

if success event `${room_id}-on-delete-member` and `${user_id}-on-room-update` will be triggered with the new value

---

### Realtime 8

#### Description

`This api is supposed to be used by admin`

#### Event

`${room_id}-member`

#### Message

`-`

#### Response

```json
{
  "_id": "662e724ecc633415df745553",
  "email": "fauzanramadhani06@gmail.com",
  "client_offset": 1,
  "createdAt": 1714319950464,
  "room_id": "662e78514f1c1456f7e8ad50"
}
```

---

### Realtime 9

#### Description

`This api is supposed to be used by admin`

#### Event

`${room_id}-on-delete-member`

#### Message

`-`

#### Response

`${deleted_member_id}`

---

### Realtime 10

#### Description

`This api is supposed to be used by user`

#### Event

`${user_id}-on-room-update`

#### Message

`-`

#### Response

`${new_room_id}`

---

### Realtime 11

#### Description

`This api is supposed to be used by admin and user`

#### Event

`$room_id`

#### Message

`-`

#### Response

```json
{
  "_id": "66264891fa600550d677b8e2", // post_id
  "room_id": "6626483efa600550d677b8e0",
  "title": "Post 2",
  "description": "Angkatan 3",
  "client_offset": 5,
  "createdAt": 1713784977905
}
```

---

### Realtime 12

#### Description

`This api is supposed to be used by admin`

#### Event

`createPost`

#### Message

```json
{
  "room_id": "662645acb3c221d33c039365",
  "title": "Liburan Idul Fitri",
  "description": "Libur akan di adakan pada tanggal 2 April 2024"
}
```

#### Response

if success event `$room_id` will be triggered with the new value

---

### HTTP Request 1

#### Description

`This api is supposed to be used by user`

#### Endpoints

`POST /register`

#### Request

**Body Parameters**

_x-www-form-urlencoded_

- `email: "fauzanramadhani06@gmail.com".`

#### Response

```json
{
  "status": "success",
  "message": "User created successfully",
  "data": {
    "user_id": "6627177e62138a136945004c"
  }
}
```

---

### HTTP Request 2

#### Description

`This api is supposed to be used by user`

#### Endpoints

`GET /get-room-id`

#### Request

**Headers**

`authorization: Bearer ${user_id}`

#### Response

```json
{
  "status": "success",
  "message": "Get room id successfully",
  "data": "662645acb3c221d33c039365"
}
```
