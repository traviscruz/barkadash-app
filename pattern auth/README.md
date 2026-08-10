# Peppino Pizza — Login/Landing Reference (Expo Router + NativeWind)

Three screens matching the mockup:
- `app/(auth)/welcome.tsx` — landing/onboarding with hero image + "Get Started"
- `app/(auth)/login.tsx` — email/password login
- `app/(auth)/register.tsx` — name/email/password registration
- `components/PizzaLogo.tsx` — stand-in logo (swap for your real asset)

## Drop-in steps
1. Copy `app/(auth)/` and `components/PizzaLogo.tsx` into your existing Expo Router project.
2. Make sure these are installed:
   ```
   npx expo install lucide-react-native react-native-svg
   npm install expo-router (if not already set up)
   ```
3. NativeWind must already be configured (tailwind.config.js content globs, babel plugin, `global.css`) — the classNames here assume it's set up the same way as the rest of your app.
4. `welcome.tsx` uses a placeholder Unsplash image — swap `HERO_IMAGE` for your own pizza photo (local asset or CDN URL).
5. Social login circles (`SocialCircle`) use plain letters as placeholders — swap for real Google/Apple/Facebook icons (e.g. `react-native-vector-icons` or brand SVGs) when you wire up OAuth.
6. Wire the `TouchableOpacity` buttons up to your actual auth logic (Supabase, etc.) — right now `Login`/`Sign in` don't call anything.

## Notes
- Color used throughout: `orange-500` (#f97316) to match the mockup's accent color.
- Routing assumes Expo Router's file-based `(auth)` group; adjust paths if your project uses React Navigation stacks instead.
