const {user, auth} = require('../models/usermodel');
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
    if (User) {
        return res.status(400).json({
            message: 'Username already exists'
        });
    } else {
        User = new user({
            username: req.body.username,
            password: req.body.password
        });
        await User.save().then(result => {
            res.status(201).jason({
                message: 'User successfully created',
                createdUser: {
                    username: result.username,
                    password: result.password
                },
                request: {
                    type: "GET",
                    url: "http://localhost:3000/users/" + result._id
                }
            });
        }).catch(error => {
            console.log(error);
            res.status(500).json({
                error: error
            });
        });
        res.send(User);
    }
});

router.get('/', (req, res, next) => {
    user.find().select('-__v').exec().then(docs => {
        const response = {
            count: docs.length,
            users: docs.map(doc => {
                return {
                    user: doc,
                    request: {
                        type: "GET",
                        url: "http://localhost:3000/users/" + doc._id
                    }
                }
            })
        }
        res.status(200).json(response);
    }).catch(error => {
        console.log(error);
        res.status(500).json({
            error: error
        });
    });
});

router.get('/:userID', (req, res, next) => {
    const id = req.params.userID;
    user.findById(id).select('-__v').exec().then(doc => {
        res.status(200).json({
            user: doc,
            request: {
                type: "GET",
                description: "Get all users at:",
                url: "http://localhost:3000/users/"
            }
        })
    }).catch(error => {
        console.log(error);
        res.status(500).json({
            error: error
        });
    });
});

router.patch('/:userID', (req, res, next) => {
    const id = req.params.userID;
    const updateOps = {};
    for (const ops of req.body) {
        updateOps[ops.propName] = ops.value;
    }
    user.updateOne({_id: id}, {$set: updateOps}).exec().then(result => {
        res.status(200).json({
            message: 'User was updated',
            request: {
                type: "GET",
                url: "http://localhost:3000/users/" + id
            }
        });
    }).catch(error => {
        console.log(error);
        res.status(500).json({
            error: error
        });
    });
});

router.delete('/:userID', (req, res, next) => {
    const id = req.params.userID;
    user.deleteOne({_id: id}).exec().then(result => {
        res.status(200).json({
            message: 'User was deleted',
            request: {
                type: "POST",
                url: "http://localhost:3000/users/",
                body: {
                    username: "String",
                    password: "String"
                }
            }
        });
    }).catch(error => {
        console.log(error);
        res.status(500).json({
            error: error
        });
    });
});

module.exports = router;