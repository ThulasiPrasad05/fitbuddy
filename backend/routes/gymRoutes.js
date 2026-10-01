const express = require("express");
const axios = require("axios");

const router = express.Router();

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY;

const PLACES_URL =
  "https://places.googleapis.com/v1/places:searchText";

const NEARBY_URL =
  "https://places.googleapis.com/v1/places:searchNearby";


// =====================================================
// CALCULATE DISTANCE
// =====================================================

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371;

  const dLat =
    (lat2 - lat1) *
    Math.PI / 180;

  const dLon =
    (lon2 - lon1) *
    Math.PI / 180;

  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +

    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *

    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}


// =====================================================
// GET NEARBY GYMS
// =====================================================

router.get("/nearby", async (req, res) => {

  try {

    const location =
      req.query.location?.trim();


    if (!location) {

      return res.status(400).json({

        message:
          "Please enter a village or city"

      });

    }


    if (!GOOGLE_API_KEY) {

      return res.status(500).json({

        message:
          "Google Maps API key is not configured"

      });

    }


    console.log(
      "🔍 Searching gyms near:",
      location
    );


    // =================================================
    // STEP 1
    // FIND LOCATION
    // =================================================

    const locationResponse =
      await axios.post(

        PLACES_URL,

        {

          textQuery:
            `${location}, India`,

          pageSize: 1,

          regionCode: "IN"

        },

        {

          timeout: 15000,

          headers: {

            "Content-Type":
              "application/json",

            "X-Goog-Api-Key":
              GOOGLE_API_KEY,

            "X-Goog-FieldMask":
              "places.displayName,places.formattedAddress,places.location"

          }

        }

      );


    const locationData =
      locationResponse.data;


    if (
      !locationData.places ||
      locationData.places.length === 0
    ) {

      return res.status(404).json({

        message:
          "Location not found. Try another village or city."

      });

    }


    const selectedLocation =
      locationData.places[0];


    const center =
      selectedLocation.location;


    console.log(
      "📍 Location found:",
      selectedLocation.displayName?.text
    );


    // =================================================
    // STEP 2
    // FIND GYMS WITHIN 5 KM
    // =================================================

    const nearbyResponse =
      await axios.post(

        NEARBY_URL,

        {

          includedTypes: [
            "gym"
          ],

          maxResultCount: 20,

          rankPreference:
            "DISTANCE",

          locationRestriction: {

            circle: {

              center: {

                latitude:
                  center.latitude,

                longitude:
                  center.longitude

              },

              radius: 5000

            }

          }

        },

        {

          timeout: 15000,

          headers: {

            "Content-Type":
              "application/json",

            "X-Goog-Api-Key":
              GOOGLE_API_KEY,

            "X-Goog-FieldMask":

              [
                "places.id",
                "places.displayName",
                "places.formattedAddress",
                "places.location",
                "places.rating",
                "places.userRatingCount",
                "places.nationalPhoneNumber",
                "places.regularOpeningHours",
                "places.googleMapsUri"

              ].join(",")

          }

        }

      );


    const nearbyData =
      nearbyResponse.data;


    // =================================================
    // STEP 3
    // FORMAT RESULTS
    // =================================================

    const gyms =
      (nearbyData.places || [])

        .map(place => {

          const distance =
            calculateDistance(

              center.latitude,

              center.longitude,

              place.location.latitude,

              place.location.longitude

            );


          return {

            id:
              place.id,

            name:
              place.displayName?.text ||
              "Gym",

            address:
              place.formattedAddress ||
              "Address not available",

            distance:
              Number(
                distance.toFixed(2)
              ),

            rating:
              place.rating ?? null,

            userRatingCount:
              place.userRatingCount ?? 0,

            phone:
              place.nationalPhoneNumber ||
              null,

            openNow:
              place.regularOpeningHours
                ?.openNow ??
              null,

            mapsUrl:
              place.googleMapsUri ||
              null

          };

        })

        .filter(
          gym =>
            gym.distance <= 5
        )

        .sort(
          (a, b) =>
            a.distance - b.distance
        );


    console.log(
      `✅ Found ${gyms.length} gyms`
    );


    // =================================================
    // SEND RESPONSE
    // =================================================

    return res.json({

      searchedLocation:
        location,

      matchedLocation:
        selectedLocation
          .displayName?.text ||
        location,

      matchedAddress:
        selectedLocation
          .formattedAddress ||
        "",

      radiusKm:
        5,

      gyms

    });


  } catch (error) {


    console.error(
      "❌ Nearby gyms error:",
      error.message
    );


    // ================================================
    // GOOGLE API ERROR
    // ================================================

    if (error.response) {

      console.error(
        "Google status:",
        error.response.status
      );

      console.error(
        "Google response:",
        error.response.data
      );


      return res.status(
        error.response.status
      ).json({

        message:
          "Google Places API error",

        error:
          error.response.data

      });

    }


    // ================================================
    // NETWORK ERROR
    // ================================================

    return res.status(500).json({

      message:
        "Unable to connect to Google Places API",

      error:
        error.message

    });

  }

});


module.exports = router;