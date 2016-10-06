// *mongoose.conf.js*

export default (mongoose) => {

  let gracefulExit = function() {

    mongoose.connection.close(() => {

      console.log('Mongoose connection ' +
        'has disconnected through app termination');

      process.exit(0);
    });
  };

  mongoose.connection.on('connected', () => {

    console.log(`Successfully connected to ${process.env.NODE_ENV}` +
      ' database on startup ');
  });

  // If the connection throws an error
  mongoose.connection.on('error', (err) => {

    console.error(`Failed to connect to ${process.env.NODE_ENV} ` +
      ' database on startup ', err);
  });

  // When the connection is disconnected
  mongoose.connection.on('disconnected', () => {

    console.log(`Mongoose default connection to ${process.env.NODE_ENV}` +
      ' database disconnected');
  });

  // If the Node process ends, close the Mongoose connection
  process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

  // replacing mongoose's promise lib:
  // https://github.com/Automattic/mongoose/issues/4291#issuecomment-230312093
  mongoose.Promise = global.Promise;

  // Connect to our MongoDB database using the MongoDB
  // connection URI from our predefined environment variable
  mongoose.connect(process.env.MONGO_URI, (error) => {

    if (error)
      throw error;
  });
};
