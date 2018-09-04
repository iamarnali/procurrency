Amazon Hackathon 2014
# Introduction
Procurrency is an offline first Progressive Web App.  
It uses the [freecurrencyconverter api](https://free.currencyconverterapi.com) to acquire a list of available currencies  
Then it populates two select lists fr the user to choose a Source and Destination currency.  
It then caches the conversion rates of the two selected currencies for use when the user device is offline.  
  
The Web app uses an offline first caching strategy and stores:  
* Conversion rates in IndexedDB.  
* HTML, CSS, and Javascript files in the cache.  

The User interface uses responsive design principles.
