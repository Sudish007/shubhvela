# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Shubhvela (A13): expo-litert-lm pulls com.google.mediapipe:tasks-genai whose generated proto classes reference
# protobuf-javalite annotation classes that are not on the runtime classpath; R8 treats them as missing classes.
# They are annotations/markers only (the generated rules from app/build/outputs/mapping/release/missing_rules.txt).
-dontwarn com.google.protobuf.Internal$ProtoNonnullApi
-dontwarn com.google.protobuf.ProtoField
-dontwarn com.google.protobuf.ProtoPresenceBits
-dontwarn com.google.protobuf.ProtoPresenceCheckedField

# Shubhvela (A13): WorkManager 2.9.1 (expo-background-task / expo-notifications) depends on Room 2.5.0, whose
# consumer rule `-keep class * extends androidx.room.RoomDatabase` does not keep the no-arg constructor under R8
# full mode (AGP >= 8 default). Room instantiates WorkDatabase_Impl reflectively -> the app crashed at startup with
# "Failed to create an instance of class androidx.work.impl.WorkDatabase.canonicalName". Keep the constructors.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
