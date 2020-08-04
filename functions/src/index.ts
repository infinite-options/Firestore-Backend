import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const fs = require( 'fs' );
const {google} = require('googleapis');

const OAuth2Client = google.auth.OAuth2
const credentials_url = 'credentials.json';
const db = admin.firestore();
const redirect_uri = "https://developers.google.com/oauthplayground";

export const ModifyFirestoreTime = functions.https.onRequest((req, res) => {
    db.collection('users').get()
    .then((snapshot) => {
        snapshot.forEach(doc => {
            if (doc.data()["goals&routines"] !== null) {
                let arrs = doc.data()["goals&routines"];
                arrs.forEach((gr: {
                    id: string,
                    start_day_and_time: string,
                    end_day_and_time: string
                }) => { 
                    const startDate = new Date(gr["start_day_and_time"]).toLocaleString('en-US', {
                        timeZone: "America/Los_Angeles"
                    });
                    const endDate = new Date(gr["end_day_and_time"]).toLocaleString('en-US', {
                        timeZone: "America/Los_Angeles"
                    });
                    gr["start_day_and_time"] = startDate;
                    gr["end_day_and_time"] = endDate;

                    db.collection("users")
                    .doc(doc.id).update({ "goals&routines": arrs })
                    .then()
                    .catch((error) => {
                        console.log('error in', doc.id);
                    });
                });
                console.log(doc.id);
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

        const userId = context.params.userId.toString();
        const newVal = change.after.data();
        const prevVal = change.before.data();

        let payload: {
            message: {data: {id: string}},
            tokens: []
        }                               
        let updateFlag = false;
        console.log('User ID:', userId);

        let i;
        for(i=0; i<newVal['goals&routines'].length; i++){
            
            if (newVal['goals&routines'].length !== prevVal['goals&routines'].length ||
                newVal['goals&routines'][i].is_available !== prevVal['goals&routines'][i].is_available ||
                newVal['goals&routines'][i].is_complete !== prevVal['goals&routines'][i].is_complete || 
                newVal['goals&routines'][i].is_in_progress !== prevVal['goals&routines'][i].is_in_progress || 
                newVal['goals&routines'][i].is_displayed_today !== prevVal['goals&routines'][i].is_displayed_today || 
                JSON.stringify(newVal['goals&routines'][i].user_notifications) !== JSON.stringify(prevVal['goals&routines'][i].user_notifications)){

                console.log('Setting updateFlag to true because goal:', JSON.stringify(newVal['goals&routines'][i].title));
                updateFlag = true;
                break;
            }
        }
        if(updateFlag){
            if(!newVal.device_token){
                console.log("User has no registered devices. Aborting.");
                return;
            }
            const deviceTokens = newVal.device_token;
            console.log('There are', deviceTokens.length, 'tokens to send notifications to.');
            
            payload = {
                message: {data: {id: userId}},
                tokens: deviceTokens
            }
        
            const responses = await admin.messaging().sendMulticast(payload);
            console.log('Success count', responses.successCount);
            console.log('Failure count', responses.failureCount);
            let validTokens: string[] = []
            responses.responses.forEach((response, index) => {
                const error = response.error;
                if(error) {
                    console.error('Failure sending notification to', deviceTokens[index]);
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                            console.log('token notregistere: ', deviceTokens[index])
                    }
                }
                if(response.success){
                    validTokens.push(deviceTokens[index])
                }
            });
            db.collection("users")
                    .doc(userId).update({ "device_token": validTokens })
                    .then((response) => {
                        console.log('Updated device tokens');
                        return;
                    })
                    .catch((error) => {
                        console.log('error in', userId);
                        return;
                    });
        }
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
