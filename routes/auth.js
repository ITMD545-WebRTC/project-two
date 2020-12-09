const joi = require('joi');
const {user} = require('../models/usermodel');
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    const {error} = auth(req.body);
    if (error) {
        return res.status(400).json({
            error: error.message
        });
    }
    let User = await user.findOne({username: req.body.username});
    if (!User) {
        return res.status(400).json({
            message: 'Incorrect username or password'
        });
    }
    res.send(true);
});

function auth(userReq) {
    const authSchema = {
        username: joi.string().required(),
        password: joi.string().required()
    };
    return joi.validate(userReq, authSchema);
}

module.exports = router;