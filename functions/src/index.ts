import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const fs = require( 'fs' );
const {google} = require('googleapis');

const OAuth2Client = google.auth.OAuth2
const credentials_url = 'credentials.json';
const db = admin.firestore();
const redirect_uri = "https://developers.google.com/oauthplayground";

export const NotificationListener = functions
    .firestore
    .document('users/{userId}')
    .onUpdate( async (change, context) => {

        //const userId = context.params.userId.toString();
        const newVal = change.after.data()['goals&routines'];
        const prevVal = change.before.data()['goals&routines'];
        //var i;

        console.log(JSON.stringify(newVal));
        console.log(JSON.stringify(prevVal))
        /*
        for(i=0; i<newVal.length; i++){
            console.log('Goal: ', JSON.stringify(newVal[i].id));
            console.log('After: Avail ', JSON.stringify(newVal[i].is_available), '   Before:', JSON.stringify(prevVal[i].is_available));
            console.log('After: Comp ', JSON.stringify(newVal[i].is_complete), '   Before:', JSON.stringify(prevVal[i].is_complete));
            console.log('After: Prog ', JSON.stringify(newVal[i].is_in_progress), '   Before:', JSON.stringify(prevVal[i].is_in_progress));
            console.log('After: Disp ', JSON.stringify(newVal[i].is_displayed_today), '   Before:', JSON.stringify(prevVal[i].is_displayed_today));
        }
        */
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
    let startParam = req.body.start.toString();
    let endParam = req.body.end.toString();

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