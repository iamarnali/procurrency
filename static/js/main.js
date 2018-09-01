const currency_store_name = 'currencies';
const conversion_store_name = 'conversions';
const currency_query = 'https://free.currencyconverterapi.com/api/v5/currencies';

//let deffered_prompt;

function make_money({currency_name = 'fake money', currency_symbol = 'replace me', id = 'fakeness'} = {}){
    // money error. exit
    if(currency_name === 'fake money') return undefined;
    if (currency_symbol === 'replace me') {
        currency_symbol = id;
    }
    return {currencyName: currency_name, currencySymbol: currency_symbol, id: id};
}

function display_currencies(currencies_objs){
    //TODO: Make this do something.. move logic here..

    const currencies = currencies_objs['results'];

    entries = Object.entries(currencies);
        for(entry of entries){
            currency = make_money({currency_name : entry[1].currencyName, currency_symbol: entry[1].currencySymbol, id: entry[1].id});
            
            const from_list = document.getElementById('from_currency');
            const to_list = document.getElementById('to_currency');

            const opt = document.createElement("option");
            const opt2 = document.createElement("option");
            opt.textContent = `${currency.id} - ${currency.currencyName} (${currency.currencySymbol})`;
            opt.setAttribute('value', currency.id);
            opt2.textContent = `${currency.id} - ${currency.currencyName} (${currency.currencySymbol})`;
            opt2.setAttribute('value', currency.id);

            if(currency.id === 'USD') opt.setAttribute('selected', '');

            if(currency.id === 'ZMW') opt2.setAttribute('selected', '');

            from_list.appendChild(opt);
            to_list.appendChild(opt2);
        }
}

function open_database(){
    if(!navigator.serviceWorker) return Promise.resolve();

    return idb.open('procurrency', 1, upgradeDb => {
        const curency_store = upgradeDb.createObjectStore(currency_store_name, {
          });
        const conversion_store = upgradeDb.createObjectStore(conversion_store_name, {
        })
    });
}

function register_serviceWorker(){
    if(!navigator.serviceWorker) return;
    
    navigator.serviceWorker.register('./sw.js').then(reg => {
        // site not called from service worker. exit early
        if(!navigator.serviceWorker.controller) return;

        if(reg.waiting){
            update_ready(reg.waiting);
            return;
        }

        if(reg.installing){
            track_installing(reg.waiting);
            return;
        }

        reg.addEventListener('updatefound', () => track_installing(reg.installing));

        // On update reload bug fix var..
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // fix bug (infini reload)
            if(refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    });
}

function track_installing(sworker){
    sworker.addEventListener('statechange', () => {
        if(sworker.state == 'installed') update_ready(sworker);
    });
}

function update_ready(worker){
    //TODO: alert user
    //FIXME: wrap this in an if for response
    worker.postMessage({uresponse: 'skipwaiting'});
}

const db_promise = open_database();
register_serviceWorker();

/*
window.addEventListener('beforeinstallprompt', e => {
    //Chrome <= 67 hack
    //e.preventDefault();
    //TODO: use the def prompt when you have a prettified prompt to show(modal bottomsheet?)
    // Stash event for future trigger (on btn click)
    //deffered_prompt = e;
    //feedback = window.confirm('Click to install a shortcut to the website on your homescreen');
});
*/

//cache for future use and display immediately.
function fetch_currencies(){
    fetch(currency_query).then(response => {
        if (response.ok) {
            return response.json()
        }
    }).then(currency_objs => {
        // cache for future use
        cache_currencies(currency_objs);
        //display to the user for their current enjoyment
        display_currencies(currency_objs);
    })
        .catch( error => console.log('There has been a problem with your currency fetch operation: ', error.message));
}
function cache_currencies(currency_objs){
    db_promise.then(db => {
        if(!db) return;

        console.log('getting trans');
        const trans = db.transaction(currency_store_name, 'readwrite');
        console.log('getting store');
        const store = trans.objectStore(currency_store_name);
        
        store.put(currency_objs, 'currencies');
        //get_currencies();
    }, error => console.log('Error querying idb: ', error.message))
        .catch( error => console.log('idb currency fetch error: ', error.message));
}

function get_currencies(){
    db_promise.then(db => {
        //First time loading, there is no db so we fetch currencies from api(then cache and display.)
        if(!db){
            fetch_currencies();
            return;
        }
        const store = db.transaction(currency_store_name).objectStore(currency_store_name);

        store.get('currencies').then(currencies_objs => {
            // if response is empty db store obj, call fetch_currencies()
            if(currencies_objs == undefined || currencies_objs == null) {
                fetch_currencies();
                return;
            }
            display_currencies(currencies_objs);
        })
    }, error => {
        console.log('currency get error :', error.message);
        // Test further before uncommenting
        //fetch_currencies();
    });
    //TODO: remove update currency list hack when you can do this on interval
    fetch_currencies();
}

//update ui with converted currencies
function display_conversions(rate = 0){
    from_amt = document.getElementById('from_ammount');
    to_amt = document.getElementById('to_ammount');

    const source_ammount = parseFloat(from_amt.value, 10);
    const ammount = rate * source_ammount;

    to_amt.value = ammount.toFixed(3);
}

// fetch a rate and cache it
function fetch_conversion(from_currency = '', to_currency = ''){
    const query = `${from_currency}_${to_currency}`;
    const query2 = `${to_currency}_${from_currency}`;
    let res = 0;
    const query_url = `https://free.currencyconverterapi.com/api/v5/convert?q=${query},${query2}&compact=ultra`;
    fetch(query_url).then(response => {if(response.ok) return response.json()}).then(conversion => {
        res = conversion[query];
        // show the user
        display_conversions(res);
        db_promise.then(db => {
            const store = db.transaction(conversion_store_name, 'readwrite').objectStore(conversion_store_name);
            // Store the conversion rate for the currency pair
            store.put(res, query);
            // Store the converse rate for fetch efficiency (save on calls to API)
            // This gives us a best case 2X on limit to calls
            store.put(conversion[query2], query2);
        }).catch(error => console.log('fetch_conv: caching error: ', error.message));
    }).catch(error => console.log('fetch_conv: fetch error: ', error.message));
}

function get_conversion(from_currency = '', to_currency = ''){
    const query = `${from_currency}_${to_currency}`;

    db_promise.then(db => {
        if(!db){
            fetch_conversion(from_currency, to_currency);
            return;
        } 
        const store = db.transaction(conversion_store_name).objectStore(conversion_store_name);
        
        store.get(query).then(rate => {
            if(rate == undefined || rate == null) {
                fetch_conversion(from_currency, to_currency);
                return;
            }
            display_conversions(rate);
        });
    });
    //TODO: replace this hach with actual cleanup and update code.
    //Hack to update content for now while it doesnt do so on interval
    fetch_conversion(from_currency, to_currency);
}

function convert(){
    from_currency = document.getElementById('from_currency').value;
    to_currency = document.getElementById('to_currency').value;
    

    get_conversion(from_currency, to_currency);

    //form hack
    return false;
}
