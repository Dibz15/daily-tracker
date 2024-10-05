import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

const SymptomInput = ({ label, value, onChange }) => (
  <div className="mb-4">
    <label className="block text-[#2596be] text-sm font-bold mb-2" htmlFor={label}>
      {label}
    </label>
    <input
      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-800 border-[#2596be] text-[#2596be]"
      id={label}
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const DailyTracker = () => {
  const [symptoms, setSymptoms] = useState({
    S: '0', 'S/M': '0', M: '0', 'M/L': '0', L: '0', 'L/XL': '0', XL: '0', XXL: '0'
  });
  const [overwhelm, setOverwhelm] = useState(false);
  const [meltdown, setMeltdown] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  
  let tokenClient;

  useEffect(() => {
    // Load the gapi client and initialize the Drive API
    window.gapi.load('client', initializeGapiClient);
    window.onload = () => gisLoaded();
  }, []);

  const initializeGapiClient = () => {
    window.gapi.client
      .init({
        apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
        discoveryDocs: [
          'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
          'https://sheets.googleapis.com/$discovery/rest?version=v4',
        ],
      })
      .then(() => {
        console.log('GAPI client initialized.');
      })
      .catch((err) => console.error('Error initializing GAPI client', err));
  };

  // Initialize the Google Identity Services (GIS) client for OAuth
  const gisLoaded = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          console.error('Error during authentication', tokenResponse);
          return;
        }
        setIsSignedIn(true);
        setAccessToken(tokenResponse.access_token);
      },
    });
    // Request access token
    // tokenClient.requestAccessToken({ prompt: 'consent' });
    if (window.gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      tokenClient.requestAccessToken({prompt: ''});
    }
  };

  const handleSymptomChange = (symptom, value) => {
    setSymptoms(prev => ({ ...prev, [symptom]: value }));
  };

  // const handleSignInSuccess = () => {
  //   tokenClient = window.google.accounts.oauth2.initTokenClient({
  //     client_id: CLIENT_ID,
  //     scope: SCOPES,
  //     callback: (tokenResponse) => {
  //       if (tokenResponse.error) {
  //         console.error('Error during authentication', tokenResponse);
  //         return;
  //       }
  //       setIsSignedIn(true);
  //       setAccessToken(tokenResponse.access_token);
  //     },
  //   });
  //   // Request access token
  //   // tokenClient.requestAccessToken({ prompt: 'consent' });
  //   if (window.gapi.client.getToken() === null) {
  //     // Prompt the user to select a Google Account and ask for consent to share their data
  //     // when establishing a new session.
  //     tokenClient.requestAccessToken({prompt: 'consent'});
  //   } else {
  //     // Skip display of account chooser and consent dialog for an existing session.
  //     tokenClient.requestAccessToken({prompt: ''});
  //   }
  // };

  const handleSignOut = () => {
    const token = window.gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken('');
        setIsSignedIn(false);
        setAccessToken(null);
        // setFiles([]);
      });
    }
  };

  const handleSubmit = async () => {
    if (!isSignedIn || !accessToken) {
      alert('Please sign in first');
      return;
    }
    console.log('Submitted data:', { ...symptoms, overwhelm, meltdown, date, timestamp: new Date() });
    const sheetName = 'Daily Symptom Tracker';
    try {
      const driveResponse = await window.gapi.client.drive.files.list({
        q: `name='${sheetName}'`,
        fields: 'files(id, name)'
      })
      let spreadsheetId;
      const files = driveResponse.result.files;
      if (files && files.length > 0) {
        spreadsheetId = files[0].id; 
        console.log('Found existing spreadsheet:', spreadsheetId);
      } else {
        const createResponse = await window.gapi.client.sheets.spreadsheets.create({
          properties: {
            title: sheetName,
          },
        });
        spreadsheetId = createResponse.result.spreadsheetId;
        console.log('Created new spreadsheet:', spreadsheetId);
              // Prepare data to append
        const range = 'Sheet1!A1';
        const values = [
          [
            'Date','S','S/M/','M','M/L','L','L/XL','XL','XXL',
            'Overwhelm','Meltdown',
          ],
        ];

        await window.gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId: spreadsheetId,
          range: range,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: values
          }
        });
        console.log('Added header to sheet')
      }

      // Prepare data to append
      const range = 'Sheet1!A1';
      const values = [
        [
          date,
          symptoms['S'],
          symptoms['S/M'],
          symptoms['M'],
          symptoms['M/L'],
          symptoms['L'],
          symptoms['L/XL'],
          symptoms['XL'],
          symptoms['XXL'],
          overwhelm,
          meltdown,
        ],
      ];

      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values
        }
      });
      console.log(`Appended data ${values} to sheet.`)
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      // Reset form
      setSymptoms({S: '0', 'S/M': '0', M: '0', 'M/L': '0', L: '0', 'L/XL': '0', XL: '0', XXL: '0'});
      setOverwhelm(false);
      setMeltdown(false);
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error submitting data:', error);
      alert('Failed to submit data');
    }
  };

  return (
    // <GoogleOAuthProvider clientId={CLIENT_ID}>
      <div className="container mx-auto max-w-md p-6 bg-gray-900 rounded-lg shadow-lg text-[#2596be]">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#2596be]">Daily Symptom Tracker</h1>
        {!isSignedIn ? (
          <div>
            Please sign in using pop-up window.
          </div>
        ) : (
          <div>
            <div>
              <h2>Fill out your symptoms</h2>
              {Object.keys(symptoms).map((symptom) => (
                <div key={symptom} className="mb-4">
                  <label className="block text-[#2596be] text-sm font-bold mb-2" htmlFor={symptom}>
                    {symptom}
                  </label>
                  <input
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-800 border-[#2596be] text-[#2596be]"
                    id={symptom}
                    type="number"
                    min="0"
                    value={symptoms[symptom]}
                    onChange={(e) => handleSymptomChange(symptom, e.target.value)}
                  />
                </div>
              ))}
              <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={overwhelm}
                  onChange={(e) => setOverwhelm(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-[#2596be] bg-gray-800 border-[#2596be]"
                />
                <span className="ml-2 text-[#2596be]">Overwhelm</span>
              </label>
              </div>

              <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={meltdown}
                  onChange={(e) => setMeltdown(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-[#2596be] bg-gray-800 border-[#2596be]"
                />
                <span className="ml-2 text-[#2596be]">Meltdown</span>
              </label>
              </div>
              <button onClick={handleSubmit} className="mt-4 p-2 bg-blue-500 text-white rounded">
                Submit
              </button>
              <button onClick={handleSignOut} className="ml-4 mt-4 p-2 bg-red-500 text-white rounded">
                Sign Out
              </button>
              {submitted && (
              <div className="mt-4 bg-gray-800 border border-[#2596be] text-[#2596be] px-4 py-3 rounded relative" role="alert">
                <AlertCircle className="inline-block mr-2" />
                <span className="block sm:inline">Data submitted successfully!</span>
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    // </GoogleOAuthProvider>
  );
};

export default DailyTracker;
