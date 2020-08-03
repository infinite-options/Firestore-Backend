import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const fs = require( 'fs' );
const {google} = require('googleapis');
//const axios = require('axios')

const OAuth2Client = google.auth.OAuth2
const credentials_url = 'credentials.json';
const db = admin.firestore();
const redirect_uri = "https://developers.google.com/oauthplayground";

export const ModifyFirestoreTime = functions.https.onRequest((req, res) => {
   
    db.collection('users').get()
    .then((snapshot) => {
        snapshot.forEach(doc => {
            if (doc.data()["goals&routines"] != null) {
                let arrs = doc.data()["goals&routines"];
                arrs.forEach((gr: {
                    id: string,
                    start_day_and_time: string,
                    end_day_and_time: string
                }) => { 
                    if(gr["id"] === 'tshZhWZLHv8Dv1XbM3M4') {
                        let startDate = new Date(gr["start_day_and_time"]).toLocaleString('en-US', {
                            timeZone: "America/Los_Angeles"
                        });
                        let endDate = new Date(gr["end_day_and_time"]).toLocaleString('en-US', {
                            timeZone: "America/Los_Angeles"
                        });

                        console.log(startDate);
                        console.log(endDate);
                    }
                });
                /*
                db.collection("users")
                .doc(doc.id)
                .update({ "goals&routines": arrs });
                */
            }
        });
        res.status(200).send('All good');
    })
    .catch(error=>{
        console.log('Error ',error)
        res.status(500).send('Error.')
    });
});

export const NotificationListener = functions
    .firestore
    .document('users/{userId}')
    .onUpdate( async (change, context) => {

        interface notificationPayload { 
                                        message : { 
                                            data : { 
                                                id: string
                                            }
                                        }, 
                                        token: string 
                                       }; 
        
        let payload: {
            message: {data: {id: string}},
            token: string
        }                               
        var notificationPayload = {} as notificationPayload
        //var url = "https://fcm.googleapis.com/v1/projects/myspace-db/messages:send/";
        const userId = context.params.userId.toString();

        const newVal = change.after.data();
        const prevVal = change.before.data();
        let updateFlag = false;
        console.log('User ID:', userId);

        let i;
        for(i=0; i<newVal['goals&routines'].length; i++){
            if (newVal['goals&routines'].length !== prevVal['goals&routines'].length ||
                newVal['goals&routines'][i].is_available !== prevVal['goals&routines'][i].is_available ||
                newVal['goals&routines'][i].is_complete !== prevVal['goals&routines'][i].is_complete || 
                newVal['goals&routines'][i].is_in_progress !== prevVal['goals&routines'][i].is_in_progress || 
                newVal['goals&routines'][i].is_displayed_today !== prevVal['goals&routines'][i].is_displayed_today || 
                newVal['goals&routines'][i].user_notifications !== prevVal['goals&routines'][i].user_notifications) {

                    console.log('Setting updateFlag to true because goal:', JSON.stringify(newVal['goals&routines'][i].title));
                    updateFlag = true;
                    break;
            }
        }
        //console.log(updateFlag);
        if(updateFlag){
            if(!newVal.device_token){
                console.log("User has no registered devices. Aborting.");
                return;
            }
            const deviceTokens = newVal.device_token;
            console.log('There are', deviceTokens.length, 'tokens to send notifications to.');
            /*const message = {
                data: {
                    id: userId
                },
                android: {
                    priority: "high"
                }
            };*/
            for(i=0; i<deviceTokens.length; i++){
                payload = {
                    message: {data: {id: userId}},
                    token: deviceTokens[i]
                }
                //notificationPayload.message = { data: {id: userId} };
                //notificationPayload.token = deviceTokens[i];
                console.log(payload);
            }
        }

        return;
        /*
        const userId = context.params.userId.toString();
        const newVal = change.after.data();

        //Check the before update and after update GR data
        if( JSON.stringify(change.before.data()['goals&routines']) === JSON.stringify(newVal['goals&routines']) ){
            console.log('No change in goals/routines for ' ,userId, '. Aborting.')
            return;
        }

        console.log('Change in goals/routines for ', userId);

        if(!newVal.device_token){
            console.log("User has no registered devices. Aborting.");
            return;
        }
        const deviceTokens = newVal.device_token;
        console.log('There are', deviceTokens.numChildren(), 'tokens to send notifications to.');

        const message = {
            data: {
                id : 'V4NXgpBIq39PDOlSgwO1'
            },
            notification: {
                title: 'Test push 1',
                body: 'Test body'
            }
        };

        const response = await admin.messaging().sendToDevice(deviceTokens,message);

        response.results.forEach((result, index)=>{
            const error = result.error;
            if (error){
                console.log('Error with token: ', deviceTokens[index])
            }
        });

        return 200;
        */
});

export const GetEventsForTheDay = functions.https.onRequest((req, res) => {

    const id = req.body.id.toString();
    const startParam = req.body.start.toString();
    const endParam = req.body.end.toString();

    console.log( 'start : ', startParam, ' end:', endParam );

    setUpAuthById( id, ( auth: any ) => {
        if(auth==500) {
            res.status(500).send('Failed to find document!');
        }
        else {
            const calendar = google.calendar( { version: 'v3', auth } );
            calendar.events.list(
                {
                    calendarId:   'primary',
                    timeMin:      startParam,
                    timeMax:      endParam,
                    maxResults:   999,
                    singleEvents: true,
                    orderBy:      'startTime'
                    //timeZone: 
                },
                (error: any, response: any) => {
                    //CallBack
                    if ( error ) {
                        res.status(500).send( 'The post request returned an error: ' + error );
                    }
                    else{
                        res.status(200).send(response.data.items);
                    }
                }
            );
        }
    });
});
  
function setUpAuthById( id: string, callback: any ) {
    console.log("SETUPAUTHBYID");
    fs.readFile( credentials_url, ( err: any, content: any ) => {
        if ( err ) {
            console.log( 'Error loading client secret file:', err );
            return;
        }
        // Authorize a client with credentials, then call the Google Calendar
        authorizeById( JSON.parse( content ), id, callback ); 
    });
  }

function authorizeById( credentials: any, id: string, callback: any ) {
    console.log("AUTHORIZEBYID");
    const { client_secret, client_id } = credentials.web;
  
    const oAuth2Client = new OAuth2Client(
        client_id,
        client_secret,
        redirect_uri
    );

    // Store to firebase
	if ( id ) {
        db.collection( 'users' ).doc( id ).get()
        .then((doc) => {
            if (!doc.exists) {
                console.log('No such document!');
                callback(500);
            }
            else {
                const userAuthInfo = doc.data();
                oAuth2Client.setCredentials( {
                access_token:  userAuthInfo!.google_auth_token,
                refresh_token: userAuthInfo!.google_refresh_token
            });
            callback(oAuth2Client);
            }
        })
        .catch(error=>{
            console.log("Error::: ", error);
        });
	}
}
