import {logger} from '../helper/logger.js';
import Settings from '../models/settings.model.js';
import Appointment from '../models/appointment.model.js';
import User from '../models/user.model.js';
import moment from 'moment-timezone';
import webpush from 'web-push';

let appointmentHelper = {
  /**
   * Parses hour as String.
   *
   * @param  {Number} hour Number representing time
   * @return {String}      'HH:mm' formatted time
   */
  printHour: hour => {
    const hourStr = '0000' + hour.toString();
    return hourStr.substr(-4, 2) + ':' + hourStr.substr(-2, 2);
  },

  /**
   * Adds increment of hours to an appointment.
   *
   * @param  {Object} appointment   Appointment object
   * @param  {Number} increment     Amount of hours to add
   * @return {Object}               Modified appointment object
   */
  addIncrement: (appointment, increment) => {
    // add increment
    appointment.hour = (appointment.hour + 100 * increment);

    // handle possible overflow
    if (appointment.hour < 0) {
      // change day to previous day if negative hour
      appointment.weekDay = appointment.weekDay === 0 ? 6 : appointment.weekDay - 1;
      appointment.hour += 2400;
    } else if (appointment.hour >= 2400) {
      // change day to next day if positive overflow
      appointment.weekDay = (appointment.weekDay + 1) % 7;
      appointment.hour %= 2400;
    }

    return appointment;
  }
};

/**
 * Sends Push Notifications to all subscribed Aamins
 */
appointmentHelper.notify = () => new Promise(async (resolve) => {
  const settings = await Settings.findOne();

  if (!settings) {
    resolve('Could not load settings entity. Aborting.');
    return;
  }

  // Find admins subscribed to appointments
  const subscribedUsers = await User
    .find({
      role: 'ROLE_ADMIN',
      'notifications.appointment': { $exists: true, $ne: [] }
    })
    .populate('notifications.appointment');

  if (!subscribedUsers) {
    resolve('No users subscribed. Aborting.');
    return;
  }

  // Find next appointment for today
  const now = moment.tz(settings.appointmentsTimezone);

  let nextAppointment = await Appointment
    .findOne({
      user: { $exists: true, $ne: null },
      weekDay: now.weekday(),
      hour: {
        $gte: now.hours() * 100 + now.minutes(),
      }
    })
    .populate('user', 'name gravatarHash')
    .then();


  if (!nextAppointment) {
    resolve('No appointment found. Aborting.');
    return;
  }

  if (settings.appointmentsIncrement) {
    // add global increment
    nextAppointment = appointmentHelper.addIncrement(nextAppointment, settings.appointmentsIncrement);
  }

  // notification object for push message
  const notification = {
    title: 'Next Appointment',
    body: `${nextAppointment.user.name} is scheduled for ${appointmentHelper.printHour(nextAppointment.hour)} ${now.format('z')}`,
    tag: 'appointment-ticker',
    icon: nextAppointment.user.gravatarHash.length === 32
      ? `https://www.gravatar.com/avatar/${nextAppointment.user.gravatarHash}?s=192`
      : null,
    silent: true,
    data: {
      url: '/schedule',
      sticky: true
    },
    sticky: true // not supported by browsers (yet)
  };

  for (const user of subscribedUsers) {
    for (const sub of user.notifications.appointment) {
      try {
        await webpush.sendNotification(JSON.parse(sub.subscription), JSON.stringify(notification));
      } catch (err) {
        logger.error(err);
      }
    }
  }

  resolve('Notifications were send. Exiting.');
});

export default appointmentHelper;
