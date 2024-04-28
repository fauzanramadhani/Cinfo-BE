require("dotenv").config();

const getRoomId = async (req, res) => {
  try {
    const user = req.user;
    return res.status(200).json({
      status: "success",
      message: "Get room_id successfully",
      data: user.room_id,
    });
  } catch (error) {
    console.log(error.message.toString());
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

module.exports = { getRoomId };
