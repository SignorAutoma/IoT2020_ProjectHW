'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate');


var DataSchema = new Schema({
    device: String,
    value: String,
    date: Date
  }, 
  {
  collection: 'values',
  retainKeyOrder: true,
  timestamps: true,
}).plugin(mongoosePaginate);


var Data = mongoose.model('Data', DataSchema);
module.exports = Data;
