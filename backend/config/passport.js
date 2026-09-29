const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(
            new Error("Google account does not provide an email"),
            null
          );
        }

        // Find existing Google account
        let user = await User.findOne({
          googleId: profile.id,
        });

        // If Google account doesn't exist
        if (!user) {
          // Check whether email already exists
          user = await User.findOne({
            email: email.toLowerCase(),
          });

          if (user) {
            return done(
              new Error(
                "An account with this email already exists. Please login with your existing account and connect Google from your profile."
              ),
              null
            );
          }

          // Create new user
          user = await User.create({
            name: profile.displayName,

            email: email.toLowerCase(),

            googleId: profile.id,

            profilePicture:
              profile.photos?.[0]?.value || "",

            role: "user",

            authProviders: {
              email: false,
              google: true,
              facebook: false,
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport;