const mongoose = require('mongoose');
const joi = require('joi');

const userSchema = mongoose.model('User', new mongoose.Schema({
    username: {type: String, unique: true, required: true, trim: true},
    password: {type: String, required: true}
}));

function authUser(user){
    const authSchema = {
        username: joi.string().required(),
        password: joi.string().required()
    };
    return joi.validate(user, authSchema);
}

exports.user = userSchema;
exports.auth = authUser;