const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    firstName: {type: String, required: true},
    lastName: {type: String, required: true},
    username: {type: String, required: true},
    phone: {type: String, required: true},
    email: {type: String, required: true},
    password: {type: String, required: true},
    confirmPassword: {type: String, required: true},
    dob: {type: String, required: true},
    country: {type: String, required: true},
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'USER' }],
    followings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'USER' }],
    bio: {type: String, ref: 'USER'},
    college: {type: String, ref: 'USER'},
    tokens: [
        {
            token: {
                type: String,
                required: true
            }
        }
    ],
    uploads: [{
        type: String,
    }],
})

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    next();
})

userSchema.methods.generateToken = async function() {
    try {
        let token = jwt.sign({_id:this._id}, process.env.SECRETKEY);
        this.tokens = this.tokens.concat({token: token});
        await this.save();
        return token;
    } catch (error) {
        console.log(`Authentication error: ${error}`);
    }
}


const User = mongoose.model('USER', userSchema);




module.exports = User;