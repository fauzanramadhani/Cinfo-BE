# Cinfo BE

Api ini dipakai untuk aplikasi Cinfo, Kami menggunakan real-time database socket-io dan http request.

### Realtime 1

#### Event

`room`

#### Message

**-**

#### Response

```json
{
  "_id": "6626483efa600550d677b8e0",
  "room_name": "Teknik Informatika wk",
  "additional": "Angkatan 3",
  "client_offset": 2,
  "createdAt": 1713784894417,
  "post_id": ["66264872fa600550d677b8e1", "66264891fa600550d677b8e2"]
}
```

### Realtime 2

#### Event

`creatRoom`

#### Message

```json
{
  "room_name": "Teknik Informatika wk",
  "additional": "Angkatan 3"
}
```

#### Response

if success event `room` will be triggered with the new value

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

-

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
