const jwt = require('jsonwebtoken');
const AllUsers = require('../models/userSchema');
const cookieParser = require('cookie-parser');
const Authenticate = async (req, res, next) => {
    try {
        const token = req.cookies.jwtoken;
        const verifyToken = jwt.verify(token, process.env.SECRETKEY);
        const rootUser = await AllUsers.findOne({ _id: verifyToken._id, "tokens.token": token });
        if (!rootUser) {
            console.log("Error thrown at rootUser interface!");
            throw new Error('User not found');
        }
        req.token = token;
        req.rootUser = rootUser;
        req.userID = rootUser._id;
        next();
    } catch (err) {
        console.log(err);
        res.status(401).render(`signinForm`);
    }
}

module.exports = Authenticate;
