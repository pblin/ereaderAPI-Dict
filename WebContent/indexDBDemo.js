(function () {

  var COMPAT_ENVS = [
    ['Firefox', ">= 16.0"],
    ['Google Chrome', ">= 24.0"]
  ];

  const DB_NAME 		= 'scholastic_dictionary';
  const DB_VERSION 		= 127; 				// Use a long for this value (don't use a float)

  const DB_STORE_NAME_DICT      = "dict";
  const DB_STORE_NAME_DICT_ISBN = "dict_isbn";
  const DB_STORE_NAME_DICT_FORM = "dict_form";

  const DB_MODE_READ_ONLY 	= 'readonly';
  const DB_MODE_READ_WRITE 	= 'readwrite';

  const DICT_SERVER_HOST 	= "localhost:8080";
//  const DICT_SERVER_HOST 	= "10.32.48.136:8080";
  const DICT_SERVER_PATH    = "/ereader/restApp/";
  const DEF_SERVER_PATH    = "/ereader/definitions/";

  var db;


  /*****************************************************************
   * open database and perform and version upgrades
   ******************************************************************/
  function openDb() {
	  
	 
    console.log("openDb ...");
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = function (evt) {
      // Better use "this" than "req" to get the result to avoid problems with
      // garbage collection.
      // db = req.result;
      db = this.result;
      console.log("openDb DONE");
//alert("***************start background task to complete word downloads still in progress");

    };
    req.onerror = function (evt) {
      console.error("openDb:", evt.target.errorCode);
    };

    req.onupgradeneeded = function (evt) {
      console.log("openDb.onupgradeneeded");

      // Look for old dictionary and delete it?
alert("Upgrading Database Version");
      try {
         if (evt.currentTarget.result.objectStoreNames.contains(DB_STORE_NAME_DICT_ISBN))
            evt.currentTarget.result.deleteObjectStore(DB_STORE_NAME_DICT_ISBN);   // TODO: set completed = N for all isbn's

         if (evt.currentTarget.result.objectStoreNames.contains(DB_STORE_NAME_DICT))
            evt.currentTarget.result.deleteObjectStore(DB_STORE_NAME_DICT);

         if (evt.currentTarget.result.objectStoreNames.contains(DB_STORE_NAME_DICT_FORM))
            evt.currentTarget.result.deleteObjectStore(DB_STORE_NAME_DICT_FORM);
      }
      catch (e) {
        ; //throw e;
      }

      // Create the isbn table DB_STORE_NAME_DICT_ISBN: Composite key is isbn-version
      var storeIsbn = evt.currentTarget.result.createObjectStore(DB_STORE_NAME_DICT_ISBN, { keyPath: 'compKey' });

      // Create the dictionary table DB_STORE_NAME_DICT: Composite key is word-version
      var storeDict = evt.currentTarget.result.createObjectStore(DB_STORE_NAME_DICT, { keyPath: 'compKey' });
      storeDict.createIndex("byDictId", "dictId", { unique: false });
      storeDict.createIndex("byDef", "def", { unique: false });

      // Create the wordform table DB_STORE_NAME_DICT_FORM: Composite key is wordform-version
      var storeWordform = evt.currentTarget.result.createObjectStore(DB_STORE_NAME_DICT_FORM, { keyPath: 'compKey' });

alert("Done Upgrading Database");
    };
  }

  /*****************************************************************
   * @param {string} store_name
   * @param {string} mode either "readonly" or "readwrite"
   ******************************************************************/
  function getObjectStore(store_name, mode) {
    var tx = db.transaction(store_name, mode);
    if (!tx)
       return tx;
    return tx.objectStore(store_name);
  }


  /*****************************************************************
   * @param {string} name
   ******************************************************************/
  function clearObjectStore(name) {
    var store = getObjectStore(name, DB_MODE_READ_WRITE);
    var req = store.clear();
    req.onsuccess = function(evt) {
      displayActionSuccess("Store " + name + " cleared");
    };
    req.onerror = function (evt) {
      console.error("clearObjectStore:", evt.target.errorCode);
      displayActionFailure(this.error);
    };
  }

  /*****************************************************************
   *
   ******************************************************************/
  function clearObjectStores() {
    clearObjectStore(DB_STORE_NAME_DICT_FORM);
    clearObjectStore(DB_STORE_NAME_DICT);
    displayAllWords();
    clearObjectStore(DB_STORE_NAME_DICT_ISBN);
    displayAllIsbns();
    displayActionSuccess("All collections cleared.");
  }

  /*****************************************************************
   * @param {string} dictId
   * @param {string} word
   * @param {string} yo
   * @param {string} def
   ******************************************************************/
  function addDefinition(dictId, word, yo, def) {
    console.log("addDefinition arguments:", arguments);
    var compKey = word + '-' + yo;
    var obj = { 'compKey': compKey, 'dictId': dictId, 'word': word, 'yo': yo, 'def': def };

    var store = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_WRITE);
    var req;
    try {
      // req = store.add(obj);
      req = store.put(obj);	// update or insert
    } catch (e) {
      ; //throw e;
    }
    req.onsuccess = function (evt) {
      console.log("Insertion in DB successful");
      displayActionSuccess("Added compKey=[" + compKey + "], dictId=[" + dictId + "], yo=[" + yo + "], word=[" + word + "]");
      displayAllWords();
      displayDefinition( word, yo );
    };
    req.onerror = function() {
      console.error("addDefinition error", this.error);
      displayActionFailure(this.error);
    };
  }


  /*****************************************************************
   * @param {string} key
   ******************************************************************/
  function deleteDefinition(word, yo) {
    console.log("deleteDefinition:", arguments);
    var key = word + "-" + yo;
//alert("deleteDefinition w/key = " + key);
    var store = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_WRITE);

    // As per spec http://www.w3.org/TR/IndexedDB/#object-store-deletion-operation
    // the result of the Object Store Deletion Operation algorithm is
    // undefined, so it's not possible to know if some records were actually
    // deleted by looking at the request result.
    var req = store.get(key);
    req.onsuccess = function(evt) {
      var record = evt.target.result;
      console.log("record:", record);
      if (typeof record == 'undefined') {
        displayActionFailure("No matching record found for key=" + key);
        return;
      }
      // Warning: The exact same key used for creation needs to be passed for
      // the deletion. If the key was a Number for creation, then it needs to
      // be a Number for deletion.
      req = store.delete(key);
      req.onsuccess = function(evt) {
        console.log("evt:", evt);
        console.log("evt.target:", evt.target);
        console.log("evt.target.result:", evt.target.result);
        console.log("delete successful");
        displayActionSuccess("Deletion key=" + key + " successful");
        displayAllWords();
      };
      req.onerror = function (evt) {
        console.error("deleteDefinition:", evt.target.errorCode);
      };
    };
    req.onerror = function (evt) {
      console.error("deleteDefinition:", evt.target.errorCode);
      };
  }


  /*****************************************************************
   * @param {string} young_old
   * @param {string} isbn
   * @param {string} elist
   * @param {string} withDefFlag
   ******************************************************************/
  function getNewDefinitionsFromServerWithElist(young_old, isbn, elist, withDefFlag)
  {
    var httphead="http://" + DICT_SERVER_HOST + DICT_SERVER_PATH;

    var requestUrl;
    if (withDefFlag == true)
    	requestUrl = httphead+'GetWordsByBookList?'+ "v=" + young_old + "&elist=" + elist + "&nlist=" + isbn;
    else
    	requestUrl = httphead+'GetWordsByBookList2?'+ "v=" + young_old + "&elist=" + elist + "&nlist=" + isbn;

//alert("URL is:" + requestUrl);

    var jsonpcallback="&jsonp=?";

    var jqxhr = $.getJSON (requestUrl+jsonpcallback, function(json)
    {
//alert(  "reponse processing");
      if (json)
      {
        var store = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_WRITE);
        for(var i = 0; i < json.length; i++)
        {
//alert("processing record " + i + " of " + json.length);
           var o = json[i];


           dictId = o.id;
           yo = o.version;
           word = o.word;
           def = o.definition;

//alert("adding def for word=" + word + ", id=" + dictId + ", yo=" + yo + ", def=" + def);
	   // WAY TOO SLOW:  Inline (below) much, much faster.
	   // addDefinition(dictId, word, yo, def);

           compKey = word + '-' + yo;
           var obj = { 'compKey': compKey, 'dictId': dictId, 'word': word, 'yo': yo, 'def': def };
           var req;
           try {
             req = store.put(obj);	// update or insert
           } catch (e) {
             ;//throw e;
           }
           req.onsuccess = function (evt) {
        	   ; //displayActionSuccess("Added compKey=[" + compKey + "], dictId=[" + dictId + "], yo=[" + yo + "], word=[" + word + "]");
           };
           req.onerror = function() {
        	   ; //displayActionFailure(this.error);
           };

        };
      }

      completeIsbn(young_old, isbn, json.length, withDefFlag);
      displayAllWords();
    });
  }


  /*****************************************************************
   * @param {string} young_old
   * @param {string} isbn
   * @param {string} elist
   * @param {string} withDefFlag
   ******************************************************************/
  function getNewDefinitionsFromServer(young_old, isbn, newOnlyFlag, withDefFlag)
  {
    console.log("getNewDefinitionsFromServer() isbn (" + young_old + ") = " + isbn);

    if (newOnlyFlag) {
      getCurrentIsbns(young_old, isbn, withDefFlag);  // Once all the isbn's are returned async, getNewDefinitionsFromServerWithElist(young_old, isbn, newOnlyFlag) will be called.
    }
    else
    {
      getNewDefinitionsFromServerWithElist(young_old, isbn, "", withDefFlag);
    }
  }


  /*****************************************************************
   * @param {string} young_old
   * @param {string} word
   ******************************************************************/
  function getDefinitionFromServer(young_old, word)
  {
    var wordform = word.toUpperCase();
    var compKey = wordform + '-' + young_old;

    var store = getObjectStore(DB_STORE_NAME_DICT_FORM, DB_MODE_READ_ONLY);
    var req;
    try {
       req = store.get(compKey);
    }
    catch (e) {
       alert("exception: " + e);
       return;
    }

    req.onsuccess = function(evt) {
      var result = evt.target.result;
      if (result)
        word = result.word;
      else
      {
        // if no wordform found, just use the word passed.  
      }
      httphead="http://" + DICT_SERVER_HOST + DICT_SERVER_PATH;

      jsonpcallback="&jsonp=?";
      var requestUrl = httphead+'GetWordDyn?'+ "v=" + young_old + "&w=" + word;

      var jqxhr = $.getJSON (requestUrl+jsonpcallback, function(json) {

        dictId=json.id;
        if (!dictId)
        {
           displayActionFailure("No definition found on server for word=[" + word + "], yo=[" + young_old + "]");
           return;
        }

        yo = json.version;
        word = json.word;
        def = json.definition;

        addDefinition(dictId, word, yo, def);
     });

    };
    req.onerror = function(evt) {
	   displayActionFailure("Error looking up wordform on client for word=[" + word + "], yo=[" + young_old + "]");
       return;
  	};

  }


  /*****************************************************************
   * @param {string} isbn
   * @param {string} yo
   ******************************************************************/
  function addIsbn(yo, isbn, newOnlyFlag, withDefFlag) {
    console.log("addIsbn arguments:", arguments);
//alert("addIsbn isbn=" + isbn + ", yo=" + yo);
    var compKey = isbn + "-" + yo;
    var obj = { 'compKey': compKey, 'isbn': isbn, 'yo': yo, 'started': 'Y', 'completed': 'N' };

    var store = getObjectStore(DB_STORE_NAME_DICT_ISBN, DB_MODE_READ_WRITE);
    var req;
    try {
      req = store.add(obj);	// insert
    } 
    catch (e) {
      ; //throw e;
    }
    req.onsuccess = function (evt) {
      displayAllIsbns();
      displayActionSuccess("Adding compKey=[" + compKey + "], isbn=[" + isbn + "], yo=[" + yo + "], Getting words from server.");
      return getNewDefinitionsFromServer(yo, isbn, newOnlyFlag, withDefFlag);
    };
    req.onerror = function() {
      console.error("addIsbn error", this.error);
//      displayActionFailure("ERROR Adding compKey=[" + compKey + "], isbn=[" + isbn + "], yo=[" + yo + "]: " + this.error);
    };
  }


  /*****************************************************************
   *
   ******************************************************************/
  function getMissingDefinitions() {
    console.log("getMissingDefinitions");

    var store = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_ONLY);
    var index = store.index("byDef");
    var req = index.openCursor(IDBKeyRange.only(""));

    req.onerror = function(evt) {
      console.error("getMissingDefinitions:", evt.target.errorCode);
    };
    req.onsuccess = function(evt) {
      var cursor = evt.target.result;
      // If the cursor is pointing at something, ask for the data
      if (cursor) {
        console.log("getMissingDefinitions cursor:", cursor);
        var value = cursor.value;
        if (value.def == "")
        {
           var id = value.dictId;
           var yo = value.yo;
           var defUrl = "http://" + DICT_SERVER_HOST + DEF_SERVER_PATH + yo + "/" + id + ".html";
           var callback = 'Json' + id + yo + 'Callback';

           $.ajax({
               url: defUrl,
               dataType: 'jsonp',
               cache: true,
               async: true,
               jsonpCallback: callback
           })
           .done(function(data, textStatus, jqXHR) {
               var word = data.word;
               var id = data.id;
               var yo = data.version;
               var def = data.definition;

               var compKey = word + '-' + yo;
               var upReq;
               var obj = { 'compKey': compKey, 'dictId': id, 'word': word, 'yo': yo, 'def': def };
               var store2 = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_WRITE);
               try {	
                  upReq = store2.put(obj);
               } 
               catch (e) {
                  ;
               }
               upReq.onsuccess = function (evt) {
                   displayActionSuccess("Got definition for compKey=[" + compKey + "], id=[" + id + "], yo=[" + yo + "], word=[" + word + "]");
               };
               upReq.onerror = function() {
                  displayActionFailure("failure for word " + word + ": " + this.error);
               };
           })
           .fail(function (jqXHR, textStatus, errorThrown) {
              displayActionFailure("failure textStatus = " + textStatus + ", errorThrown = " + errorThrown);
           });
        }

        // Move on to the next object in store
        cursor.continue();
      }
    };
  }

  function JsonDefinitionCallback(){
	    alert("json definition callback 0.");
  }

  function JsonDefinitionCallback(data){
	    alert("json definition callback 1.");
  }


  function getMissingDefinitions2() {
    console.log("getMissingDefinitions");

    var store = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_ONLY);
    var index = store.index("byDef");
    var req = index.openCursor(IDBKeyRange.only(""));

    req.onerror = function(evt) {
      console.error("getMissingDefinitions:", evt.target.errorCode);
    };
    req.onsuccess = function(evt) {
      var cursor = evt.target.result;
      // If the cursor is pointing at something, ask for the data
      if (cursor) {
        console.log("getMissingDefinitions cursor:", cursor);
        var value = cursor.value;
        if (value.def == "")
        {
           var word = value.word;
           var id = value.dictId;
           var yo = value.yo;

           var defUrl = "http://" + DICT_SERVER_HOST + DEF_SERVER_PATH + yo + "/" + id + ".html";
//alert("Need definition for " + word + " " + yo + " id=" + id + " from URL=[" + defUrl + "]");

           var xmlHttp = new XMLHttpRequest();
           xmlHttp.onreadystatechange=function()
           {
//alert("state change readyState=[" + xmlHttp.readyState + "], status=[" + xmlHttp.status + "], responseText=[" + xmlHttp.responseText + "], responseXML =[" + xmlHttp.responseXML  + "], responseType =[" + xmlHttp.responseType  + "]");
              if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
              {
                     var compKey = word + '-' + yo;
                     var def = xmlHttp.responseText;
                     var upReq;
	                 var obj = { 'compKey': compKey, 'dictId': id, 'word': word, 'yo': yo, 'def': def };
	                 var store2 = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_WRITE);
                     try {	
                        // upReq = cursor.update(cursor.value);
					    upReq = store2.put(obj);
                     } 
                     catch (e) {
                    	 ;
                     }
                     upReq.onsuccess = function (evt) {
                         displayActionSuccess("Got definition for compKey=[" + compKey + "], id=[" + id + "], yo=[" + yo + "], word=[" + word + "]");
//alert("definition success for word " + word);                     
                     };
                     upReq.onerror = function() {
//alert("definition failure for word " + word + ": " + this.error);                     
                        displayActionFailure(this.error);
                     }; 
              }
//alert("state change done");
           }
//alert("Open URL=[" + defUrl + "]");
           xmlHttp.open("GET", defUrl, false);
//alert("Send URL=[" + defUrl + "]");
           xmlHttp.send();
//alert("Done URL=[" + defUrl + "]");
//alert("after done readyState=[" + xmlHttp.readyState + "], status=[" + xmlHttp.status + "], responseText=[" + xmlHttp.responseText + "], responseXML =[" + xmlHttp.responseXML  + "], responseType =[" + xmlHttp.responseType  + "]");

        }

        // Move on to the next object in store
        cursor.continue();
      }
    };
  }

  /*****************************************************************
   * @param {string} yo
   * @param {string} isbn
   * @param {string} cnt
   * @param {string} withDefFlag
   ******************************************************************/
  function completeIsbn(yo, isbn, cnt, withDefFlag) {
    console.log("completeIsbn arguments:", arguments);
//alert("completeIsbn isbn=" + isbn + ", yo=" + yo);
    if (withDefFlag == false)
  	   getMissingDefinitions();

    var compKey = isbn + "-" + yo;
    var obj = { 'compKey': compKey, 'isbn': isbn, 'yo': yo, 'started': 'Y', 'completed': 'Y' };	// NOTE 'completed'='Y'

    var store = getObjectStore(DB_STORE_NAME_DICT_ISBN, DB_MODE_READ_WRITE);
    var req;
    try {
      req = store.put(obj);	// update to completed
    } 
    catch (e) {
      ; //throw e;
    }
    req.onsuccess = function (evt) {
//alert("DONE processing isbn" + isbn + "!");
      displayActionSuccess("Completed getting " + cnt + " words from server for isbn=[" + isbn + "], yo=[" + yo + "].");
      displayAllIsbns();
    };
    req.onerror = function() {
      console.error("completeIsbn error", this.error);
//      displayActionFailure("ERROR Getting words from server for isbn=[" + isbn + "], yo=[" + yo + "]: " + this.error);
    };
  }


  /*****************************************************************
   * @param {string} yo
   * @param {string} isbn
   ******************************************************************/
  function deleteIsbn(yo, isbn) {
    console.log("deleteIsbn:", arguments);
//alert("deleteIsbn w/key = " + key);
    var key = isbn + "-" + yo;
    var store = getObjectStore(DB_STORE_NAME_DICT_ISBN, DB_MODE_READ_WRITE);

    // As per spec http://www.w3.org/TR/IndexedDB/#object-store-deletion-operation
    // the result of the Object Store Deletion Operation algorithm is
    // undefined, so it's not possible to know if some records were actually
    // deleted by looking at the request result.
    var req = store.get(key);
    req.onsuccess = function(evt) {
      var record = evt.target.result;
      console.log("record:", record);
      if (typeof record == 'undefined') {
        displayActionFailure("No matching record found for key=" + key);
        return;
      }
      // Warning: The exact same key used for creation needs to be passed for
      // the deletion. If the key was a Number for creation, then it needs to
      // be a Number for deletion.
      req = store.delete(key);
      req.onsuccess = function(evt) {
        console.log("evt:", evt);
        console.log("evt.target:", evt.target);
        console.log("evt.target.result:", evt.target.result);
        console.log("delete successful");
        displayActionSuccess("Deletion key=" + key + " successful");
        displayAllIsbns();
      };
      req.onerror = function (evt) {
        console.error("deleteDefinition:", evt.target.errorCode);
      };
    };
    req.onerror = function (evt) {
      console.error("deleteDefinition:", evt.target.errorCode);
      };
  }



  /*****************************************************************
   * Get a list of existing isbns's for given young_old (i.e.version).
   * Used to avoid getting duplicate words from the server for new isbn
   *
   * @param {string} young_old
   * @param {string} isbn
   * @param {string} withDefFlag
   ******************************************************************/
  function getCurrentIsbns(young_old, isbn, withDefFlag) {
    console.log("getCurrentIsbns");

    var store = getObjectStore(DB_STORE_NAME_DICT_ISBN, DB_MODE_READ_ONLY);

    var i = 0;
	var isbnList = "";
    var req = store.openCursor();
    req.onerror = function(evt) {
      console.error("getCurrentIsbns error:", evt.target.errorCode);
    };
    req.onsuccess = function(evt) {
      var cursor = evt.target.result;
      // If the cursor is pointing at something, ask for the data
      if (cursor) {
        console.log("getCurrentIsbns cursor:", cursor);
        var value =  cursor.value;
		if (value.yo == young_old && value.isbn != isbn)
		{
			if (isbnList == "")
				isbnList = value.isbn;
			else
				isbnList = isbnList + "," + value.isbn;
		}
	        
        // Move on to the next object in store
        cursor.continue();

        // This counter serves only to create distinct ids
        i++;
      } 
      else {
// alert("DONE: building isbn list.  getting definitions with existingIsbnList=[" + isbnList + "]");
        getNewDefinitionsFromServerWithElist(young_old, isbn, isbnList, withDefFlag);
      }
    };
  }


  /*****************************************************************
   * Get all wordforms for young and old dictionary from the server.
   ******************************************************************/
  function getAllWordforms()
  {
    var httphead="http://" + DICT_SERVER_HOST + DICT_SERVER_PATH;

    var requestUrl = httphead+'GetWordForms';
//alert("URL is:" + requestUrl);

    var jsonpcallback="?jsonp=?";

    var jqxhr = $.getJSON (requestUrl+jsonpcallback, function(json)
    {
//alert("processing response");
      var cnt = 0;
      if (json)
      {
        var store = getObjectStore(DB_STORE_NAME_DICT_FORM, DB_MODE_READ_WRITE);
        for(var i = 0; i < json.length; i++)
        {
//alert("processing record " + i + " of " + json.length);
           var o = json[i];

           // {"id":"4030355","wordform":"ZOO","word":"zoo","version":"YD"},

           dictId = o.id;
           yo = o.version;
           word = o.word;
           wordform = o.wordform;

//alert("adding wordform=" + wordform + ", word=" + word + ", id=" + dictId + ", yo=" + yo);

           compKey = wordform + '-' + yo;
           var obj = { 'compKey': compKey, 'dictId': dictId, 'wordform': wordform, 'word': word, 'yo': yo };
           var req;
           try {
             req = store.put(obj);	// update or insert
           } 
           catch (e) {
             ; //throw e;
           }
           req.onsuccess = function (evt) {
        	   ;
           };
           req.onerror = function() {
        	   ;
           };
        }
        cnt = json.length;
      }

      displayActionSuccess("Completed getting " + cnt + " wordforms from server");
      // displayAllWordforms();
    });
  }


  openDb();	/**** Open the indexDB database ****/


/******************************************************************************************************************/
//
// UI for the DEMO
//
/******************************************************************************************************************/
  var isDemo = true;

  addEventListeners();

  /*****************************************************************
   *
   ******************************************************************/
  function displayActionSuccess(msg) {
    if (isDemo) {
      msg = typeof msg != 'undefined' ? "Success: " + msg : "Success";
      $('#msg').html('<span class="action-success">' + msg + '</span>');
    }
  }

  /*****************************************************************
   *
   ******************************************************************/
  function displayActionFailure(msg) {
    if (isDemo) {
      msg = typeof msg != 'undefined' ? "Failure: " + msg : "Failure";
      $('#msg').html('<span class="action-failure">' + msg + '</span>');
    }
  }

  /*****************************************************************
   *
   ******************************************************************/
  var compat = $('#compat');
  compat.empty();
  compat.append('<ul id="compat-list"></ul>');
  COMPAT_ENVS.forEach(function(val, idx, array) {
    $('#compat-list').append('<li>' + val[0] + ': ' + val[1] + '</li>');
  });


  /*****************************************************************
   *
   ******************************************************************/
  function displayAllIsbns() {
    console.log("displayAllIsbns");

    var store = getObjectStore(DB_STORE_NAME_DICT_ISBN, DB_MODE_READ_ONLY);

    var isbnlist_msg = $('#isbnlist-msg');
    isbnlist_msg.empty();
    var isbn_list = $('#isbn-list');
    isbn_list.empty();

    var req;
    req = store.count();
    // Requests are executed in the order in which they were made against the
    // transaction, and their results are returned in the same order.
    // Thus the count text below will be displayed before the actual word list
    // (not that it is algorithmically important in this case).
    req.onsuccess = function(evt) {
      isbnlist_msg.append('<p>There are <strong>' + evt.target.result +
                     '</strong> record(s) in the isbn store.</p>');
    };
    req.onerror = function(evt) {
      console.error("add error", this.error);
      displayActionFailure(this.error);
    };

    var i = 0;
    req = store.openCursor();
    req.onerror = function(evt) {
      console.error("displayAllIsbns:", evt.target.errorCode);
    };
    req.onsuccess = function(evt) {
      var cursor = evt.target.result;
      // If the cursor is pointing at something, ask for the data
      if (cursor) {
        console.log("displayAllIsbns cursor:", cursor);
        var value =  cursor.value;
        var list_item = $("<li>" + "isbn=[" + value.isbn + "] " + "</li>");

        if (value.yo != null)
           list_item.append(", yo=[" + value.yo + "]");
        if (value.started != null)
           list_item.append(", started=[" + value.started + "]");
        if (value.completed != null)
           list_item.append(", completed=[" + value.completed + "]");

        isbn_list.append(list_item);

        // Move on to the next object in store
        cursor.continue();

        // This counter serves only to create distinct ids
        i++;
      } else {
//alert("NO MORE isbn entries?");
        console.log("No more entries");
      }

    };
  }


  /*****************************************************************
   *
   ******************************************************************/
  function displayAllWords() {
    console.log("displayAllWords");

//alert("start displayallwords.");    
    displayDefinition( "", "" );
//alert("back in displayallwords.");

    var store = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_ONLY);

    var wordlist_msg = $('#wordlist-msg');
    wordlist_msg.empty();
    var word_list = $('#word-list');
    word_list.hide();
    word_list.empty();

    var req;
    req = store.count();
    // Requests are executed in the order in which they were made against the
    // transaction, and their results are returned in the same order.
    // Thus the count text below will be displayed before the actual word list
    // (not that it is algorithmically important in this case).
    req.onsuccess = function(evt) {
      wordlist_msg.append('<p>There are <strong>' + evt.target.result +
                    '</strong> word(s) in the dictionary store.</p>');
    };
    req.onerror = function(evt) {
      console.error("add error", this.error);
      displayActionFailure(this.error);
    };

    var i = 0;
    req = store.openCursor();
//    var index = store.index('byWord');
//    req = index.openCursor(null, 'next');

    req.onerror = function(evt) {
      console.error("displayAllWords:", evt.target.errorCode);
      word_list.show();
    };
    req.onsuccess = function(evt) {
      var cursor = evt.target.result;
      // If the cursor is pointing at something, ask for the data
      if (cursor) {
        console.log("displayAllWords cursor:", cursor);
        var value = cursor.value;
        var def = value.def;
        var word = value.word;
        var yo = value.yo;
        var dictId = value.dictId;

        var list_item = $("<li>" + " " + "</li>");

        var link = $('<a href="#">' + word + '</a>');
        link.on('click', function() { displayDefinition( word, yo ); return false; });
        var haveDef = true;
        if (def == "")
           haveDef = false;
        list_item.append(link).append(' (yo=').append(yo).append(', id=').append(dictId).append(', haveDef=').append(haveDef==true?'true':'false').append(')');
        word_list.append(list_item);

        // Move on to the next object in store
        cursor.continue();

        // This counter serves only to create distinct ids
        i++;
      } 
      else {
//alert("NO MORE entries.");
          word_list.show();

    	  console.log("No more entries");
      }
    };
  }


  /*****************************************************************
   *
   ******************************************************************/
  function setDefinitionInViewer(def) {
  	 var defWindow=window.open('','defWindow','width=600,height=800', true);
 	 defWindow.document.open();
 	 defWindow.document.write(def);
 	 defWindow.document.close();
  }
  
  
  /*****************************************************************
   *
   ******************************************************************/
  function displayDefinition(word, yo) {
//alert("displayDefiniton called with word=" + word + ", yo=" + yo);
     if (word == "")
     {
    	 setDefinitionInViewer("");
     	 return;
     }
     var store = getObjectStore(DB_STORE_NAME_DICT, DB_MODE_READ_WRITE);
     var key = word + "-" + yo;
     var req = store.get(key);
     req.onsuccess = function(evt) {
        var record = evt.target.result;
        if (record == null)
        {
           displayActionFailure("No record for key = " + key);
           return;
        }
        if (record.def == "")
        {
           displayActionFailure("No definition for word = " + word + " (" + yo + ")");
           return;
        }
        setDefinitionInViewer(record.def);
	 };
  }

  
  /*****************************************************************
   *
   ******************************************************************/
  function setWordsList(wordsTable) {
    // alert("setting words viewer to [" + def + "]");
    document.getElementById("word-list").innerHTML = wordsTable;
    // alert("done setting words viewer");
  }


  /*****************************************************************
   *
   ******************************************************************/
  function displayAllWordforms() {
// alert("displayAllWordforms start");
    console.log("displayAllWordforms");

    var store = getObjectStore(DB_STORE_NAME_DICT_FORM, DB_MODE_READ_ONLY);

    var wordlist_msg = $('#wordlist-msg');
    wordlist_msg.empty();
    var word_list = $('#word-list');
    word_list.empty();
    var wordblock = "";
    
    var req;
    req = store.count();
    // Requests are executed in the order in which they were made against the
    // transaction, and their results are returned in the same order.
    // Thus the count text below will be displayed before the actual word list
    // (not that it is algorithmically important in this case).
    req.onsuccess = function(evt) {
      wordlist_msg.append('<p>There are <strong>' + evt.target.result +
                    '</strong> word FORM(s) in the dictionary store.</p>');
    };
    req.onerror = function(evt) {
      console.error("word FORM count error", this.error);
      displayActionFailure("word FORM count error: " + this.error);
    };

    var i = 0;
    req = store.openCursor();

    req.onerror = function(evt) {
      console.error("displayAllWordforms:", evt.target.errorCode);
    };
    req.onsuccess = function(evt) {
      var cursor = evt.target.result;
      // If the cursor is pointing at something, ask for the data
      if (cursor) {
        console.log("displayAllWords cursor:", cursor);
        var value = cursor.value;

        var list_item = $("<li>" + " " + "</li>");
        list_item.append(value.wordform + " --> " + value.word);
        list_item.append(" " + value.yo);
        wordblock += list_item;
 	    // word_list.append(list_item);

        // Move on to the next object in store
        cursor.continue();

        // This counter serves only to create distinct ids
        i++;
      } else {
        // alert("NO MORE entries.");
        word_list.empty();
        word_list.append(wordblock);
        console.log("No more entries");
      }
    };
  }


  /*****************************************************************
   *
   ******************************************************************/
  function addEventListeners() {
    console.log("addEventListeners");

    var list_word_button = $('#list-word-button');
    list_word_button.click(function(evt) {
      displayAllWords();
    });

    var word_forms_button = $('#word-forms-button');
    word_forms_button.click(function(evt) {
      getAllWordforms();
    });
    
    var miss_def_button = $('#miss-def-button');
    miss_def_button.click(function(evt) {
    	getMissingDefinitions();
    });
    
    

    $('#add-word-button').click(function(evt) {
      console.log("add ...");
      var word = $('#word').val();
      var dictId = $('#dictId').val();
      var yo = $('#yo').val();
      var def = $('#definition').val();
      if (!def && word) {
      	return getDefinitionFromServer(yo, word);
      }

      if (!word || !dictId || !def) {
        displayActionFailure("Required field(s) missing");
        return;
      }
      addDefinition(dictId, word, yo, def);
    });

    $('#delete-word-button').click(function(evt) {
      console.log("delete ...");
      var word = $('#word').val();
      var yo = $('#yo').val();
      deleteDefinition(word, yo);
    });


    var list_isbn_button = $('#list-isbn-button');
    list_isbn_button.click(function(evt) {
      displayAllIsbns();
    });

    $('#add-isbn-button').click(function(evt) {
      var isbnId = $('#isbnId').val();
      var version = $('#version').val();
      if (!isbnId || !version) {
        displayActionFailure("Required field(s) missing");
        return;
      }
      addIsbn(version, isbnId, false, true);
    });

    $('#add-isbn-button-new').click(function(evt) {
        var isbnId = $('#isbnId').val();
        var version = $('#version').val();
        if (!isbnId || !version) {
          displayActionFailure("Required field(s) missing");
          return;
        }
        addIsbn(version, isbnId, true, true);
      });

    $('#add-isbn-button-new-only').click(function(evt) {
        var isbnId = $('#isbnId').val();
        var version = $('#version').val();
        if (!isbnId || !version) {
          displayActionFailure("Required field(s) missing");
          return;
        }
        addIsbn(version, isbnId, true, false);
      });



    $('#delete-isbn-button').click(function(evt) {
      var isbnId = $('#isbnId').val();
      var version = $('#version').val();
      deleteIsbn(version, isbnId);
    });



    $('#clear-store-button').click(function(evt) {
      if (!confirm('Delete ALL Local Data?')) {
        return;
      }
      clearObjectStores();
    });

  }


})(); // Immediately-Invoked Function Expression (IIFE)
