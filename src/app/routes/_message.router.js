import Message from '../models/message.model.js';
import User from '../models/user.model.js';
let ObjectId = require('mongoose').Types.ObjectId;
import moment from 'moment';
import escapeStringRegexp from 'escape-string-regexp';

export default (app, router, io) => {

  /**
   * @api {get} /api/message Get chat history
   * @apiName ListMessages
   * @apiGroup Message
   *
   * @apiSuccess {Object[]} messages           List of recent messages.
   * @apiSuccess {String}   messages.text      Message body
   * @apiSuccess {Date}     messages.createdAt Date of creation
   * @apiSuccess {User}     messages.user      The posting user
   */
  router.get('/api/message', async (req, res) => {
    try {
      const msgPerPage = 50;
      const page = req.query.page || 0;

      let messages = await Message
        .find(
          req.user._doc.role === 'ROLE_ADMIN'
          ? { deleted: { $ne: true } }
          : {}
        )
        .sort([['createdAt', 'descending']])
        .skip(msgPerPage * page)
        .limit(msgPerPage)
        .populate('user', 'name gravatarHash lastMeditation country')
        .lean()
        .then();

      messages.reverse();

      res.json(messages);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  /**
   * @api {get} /api/message/synchronize Fetches messages for a specific timeframe
   * @apiName SynchronizeMessages
   * @apiGroup Message
   *
   * @apiSuccess {Object[]} messages           List of messages.
   * @apiSuccess {String}   messages.text      Message body
   * @apiSuccess {Date}     messages.createdAt Date of creation
   * @apiSuccess {User}     messages.user      The posting user
   */
  router.post('/api/message/synchronize', async (req, res) => {
    try {
      const timeFrameStart = moment(req.body.timeFrameStart);
      const timeFrameEnd = moment(req.body.timeFrameEnd);

      let criteria = {
        createdAt: {
          $gt: timeFrameStart,
          $lte: timeFrameEnd
        },
        deleted: { $ne: true }
      };

      if (req.user._doc.role === 'ROLE_ADMIN') {
        delete criteria['deleted'];
      }

      let messages = await Message
        .find(criteria)
        .sort([['createdAt', 'descending']])
        .populate('user', 'name gravatarHash lastMeditation country')
        .lean()
        .then();

      messages.reverse();

      res.json(messages);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  /**
   * @api {post} /api/message Post a new message
   * @apiName AddMessage
   * @apiGroup Message
   *
   * @apiParam {String} text Message body
   */
  router.post('/api/message', async (req, res) => {
    try {
      let text = req.body.text ? req.body.text : '';
      let mentions = [];

      let possibleMentions = text.match(new RegExp('@[^@\\s]*(\\s[^@\\s]+)?$', 'gi'));

      if (possibleMentions) {
        possibleMentions.map(name => {
          let user = await User.find({
            name: name
          });

          if (user.length === 1) {
            mentions.push({
              _id: _id,
              name: name
            });
          }

          // check if message text actually contains the mentioning
          if (user && req.body.text.indexOf('@' + user.name) > -1) {
            // notify user if possible
            // ...

            mentnions.push({ _id: user._id, name: user.name });
          }
        });
      }

      let message = await Message.create({
        text: req.body.text,
        user: req.user._doc,
        mentions: mentions
      });

      // fetch previous message to detect missed timespans on the client
      const previousMessage = await Message
        .findOne()
        .sort('-createdAt')
        .skip(1)
        .then();

      // add user details for response and broadcast
      let populated = await message.populate(
        'user',
        'name gravatarHash country lastMeditation'
      ).execPopulate();

      // sending broadcast WebSocket message
      io.sockets.emit('message', {
        previous: previousMessage,
        current: populated
      });


      res.json(populated);
    } catch (err) {
      res
        .status(err.name === 'ValidationError' ? 400 : 500)
        .send(err);
    }
  });

  /**
   * @api {put} /api/message/:id Edit new message
   * @apiName EditMessage
   * @apiGroup Message
   *
   * @apiParam {String} text Message body
   */
  router.put('/api/message/:id', async (req, res) => {
    try {
      let message = await Message.findOne({
        _id: ObjectId(req.params.id)
      })
      .exec();

      if (!message) return res.sendStatus(404);

      // only allow to edit own messages (or being admin)
      if (message.user != req.user._doc._id &&
        req.user._doc.role !== 'ROLE_ADMIN') {
        return res.sendStatus(400);
      }

      // only allow to edit messages for 30 minutes
      if (req.user._doc.role !== 'ROLE_ADMIN') {
        const created = moment(message.createdAt);
        const now = moment();
        const duration = moment.duration(now.diff(created));

        if (duration.asMinutes() >= 30) {
          return res.sendStatus(400);
        }
      }

      message.text = req.body.text;
      message.edited = true;
      await message.save();

      // add user details for response and broadcast
      let populated = await message.populate(
        'user',
        'name gravatarHash country lastMeditation'
      ).execPopulate();

      // sending broadcast WebSocket message
      io.sockets.emit('message-update', {
        populated
      });

      res.json(populated);
    } catch (err) {
      res
        .status(err.name === 'ValidationError' ? 400 : 500)
        .send(err);
    }
  });

  /**
   * @api {delete} /api/message/:id Delete message
   * @apiName DeleteMessage
   * @apiGroup Message
   */
  router.delete('/api/message/:id', async (req, res) => {
    try {
      let message = await Message.findOne({
        _id: ObjectId(req.params.id)
      })
      .exec();

      if (!message) return res.sendStatus(404);

      // only allow to edit own messages (or being admin)
      if (message.user != req.user._doc._id &&
        req.user._doc.role !== 'ROLE_ADMIN') {
        return res.sendStatus(400);
      }

      message.deleted = true;
      await message.save();

      // add user details for response and broadcast
      let populated = await message.populate(
        'user',
        'name gravatarHash country lastMeditation'
      ).execPopulate();

      // sending broadcast WebSocket message
      io.sockets.emit('message-update', {
        populated
      });

      res.json(populated);
    } catch (err) {
      res
        .status(err.name === 'ValidationError' ? 400 : 500)
        .send(err);
    }
  });

  /**
   * @api {post} /api/autocomplete Search users matching a search string
   * @apiName ListAutocomplete
   * @apiGroup Message
   *
   * @apiParam {String} search pattern for username
   */
  router.post('/api/message/autocomplete', async (req, res) => {
    try {
      const query = req.body.query ? req.body.query : '';

      if (!query) {
        return res.sendStatus(400);
      }

      let matches = await User
        .find({
          name: new RegExp('^' + escapeStringRegexp(query), 'i'),
          // earlier than 1 month
          // lastActive: { $lt: Date.now() - 2628E6 }
        }, 'name gravatarHash _id country')
        .sort({
          lastActive: -1
        })
        .limit(10)
        .lean()
        .exec();

      res.json(matches);
    } catch (err) {
      res
        .status(err.name === 'ValidationError' ? 400 : 500)
        .send(err);
    }
  });
};
