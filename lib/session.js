export const sessionOptions = {
  password: "complex_password_at_least_32_characters_long",
  cookieName: "raga_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
}
