#RambleIO


## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app on android

   ```bash
   npx expo run:android
   ```
   or if you already have a development build you can start with 

   ```bash
   npx expo start
   ```

   if there is an issue with connection to device try :
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```
   and reload on the device. 

3. changes to convex schema need to be syncronized with server. launch the convex development server with : 

   ```basg
   npx convex dev
   ```


