# Cinfo BE

Api ini dipakai untuk aplikasi Cinfo, Kami menggunakan real-time database socket-io dan http request.

---

### Realtime 1

#### Event

`room`

#### Message

-

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

#### Event

`createRoom`

#### Message

```json
{
  "room_name": "Teknik Informatika wk",
  "additional": "Angkatan 3"
}
```

#### Response

if success event `room` will be triggered with the new value

---

### Realtime 3

#### Event

`editRoom`

#### Message

```json
{
  "_id": "662645acb3c221d33c039365",
  "room_name": "Teknik Informatika 1",
  "additional": "Angkatan 1"
}
```

#### Response

if success event `room` will be triggered with the new value

---

### Realtime 4

#### Event

`$room_id`

#### Message

-

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

### Realtime 5

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

### HTTP Request

#### Endpoints

`GET /endpoint`

#### Request

**Query Parameters**

- `parameter1`: Deskripsi tentang parameter ini. Contoh: `value1` - Deskripsi nilai.

#### Response

Contoh respons yang diharapkan:

```json
{
  "key1": "value1",
  "key2": "value2"
}
```
