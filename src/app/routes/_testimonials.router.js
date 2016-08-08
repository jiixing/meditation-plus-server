import Testimonial from '../models/testimonials.model.js';

import moment from 'moment';

export default (app, router, io) => {

  router.get('/api/testimonials/:id', async (req, res) => {
    try {
      let allowUser = true;
      let testimonials = await Testimonial
        .find({
          'reviewed' : false
        })
        .sort([['createdAt', 'descending']])
        .populate('user', 'name gravatarHash')
        .lean()
        .then();

      testimonials.map(testimonial => {
        testimonial.date = moment(testimonial.createdAt).format('D. MMMM Y');
        
        if (testimonial.user._id == req.params.id){
          allowUser = false;
        }
        if (testimonial.anonymous) {
          testimonial.user = { name : 'Anonymous' };
        }

        return testimonial;
      })

      res.json({
        allowUser: allowUser,
        testimonials: testimonials
      });
    } catch (err) {
      res.status(500).send(err);
    }
  });

  router.post('/api/testimonials', async (req, res) => {
    try {
      let testimonial = await Testimonial.create({
        text: req.body.text,
        user: req.user._doc,
        reviewed: false, // default: false
        anonymous: req.body.anonymous || false
      });

      // add user details for response and broadcast
      let populated = await testimonial.populate(
        'user',
        'name gravatarHash'
      ).execPopulate();


      let leanObject = populated.toObject();
      // leanObject.ago = moment(leanObject.createdAt).fromNow();

      // sending broadcast WebSocket testimonial
      io.sockets.emit('testimonial', leanObject);

      res.json(leanObject);
    } catch (err) {
      let errStatus = 500;

      if (err.name == 'ValidationError' || err.name == 'MongoError'){
        errStatus = 400;
      }

      res
        .status(errStatus)
        .send(err);
    }
  });

};
