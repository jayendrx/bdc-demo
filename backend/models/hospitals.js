const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
    {
        name: {type: String, required: true},
        phone: {type: String, required: true},
        current: {type: Number, required: true},
        target: {type: Number, required: true},
        waiting: {type: Number, required: true},
        beds: {type: Number, required: true},
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isLocked: {
            type: Boolean,
            default: false,}
    },
    { timestamps: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);