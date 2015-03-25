package com.scholastic.ereader;
import org.perf4j.aop.Profiled;

import java.io.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Properties;

import com.mongodb.Mongo;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.BasicDBObject;
import com.mongodb.DBCursor;
import com.google.gson.*;

// import javax.jws.WebService;

// @WebService (endpointInterface = "com.scholastic.ereader.bookapiImpl")

public class BookApiImpl implements BookApi {
	private static Mongo m = null;
	private static String mongohost;
	private static String mongodbname;
	private static DB mdb = null;

final  public String hello() {
	String result = "hello 6/11 12:57";
	return result;
}

@Profiled(tag = "connectMongoDB")
static public DB connectMongoDB ()
{
	if (mdb == null) {
	 try
	 {
		File f = new File(System.getProperty("jboss.server.config.dir"),
            "config.properties");

		Properties prop = new Properties();
		prop.load(new FileInputStream(f));

		mongohost = prop.getProperty("mongohost").toString();
		mongodbname = prop.getProperty("dbname").toString();

		System.out.println(mongohost);
		System.out.println(mongodbname);
		m = new Mongo(mongohost, 27017);
		mdb = m.getDB(mongodbname);
	 }
	catch (Exception e) {
		e.printStackTrace();
	 }
	}
	return mdb;
}


@Profiled(tag = "GetContentMetaData_{$0}")
final public String GetContentMetaData(String id, String token) {
	return new ContentMetaData(id).get(connectMongoDB());
}


@Profiled(tag = "GetContentFragments_{$0}")
final public String GetContentFragments(final String id,
										final String token,
										final String type,
										final String refIds) {

	ArrayList<HashMap<String,String>> fragList =
					new ArrayList<HashMap<String,String>>();
	try {
		//String loc = getClass().getName().replace('.', '/') +"/";

		DBCollection coll = connectMongoDB().getCollection(id);
		BasicDBObject query = new BasicDBObject();
		String[] idList = refIds.split(",");
		System.out.println("type="+type);

		for (Integer i = 0; i < idList.length; i++)
		{
			query.put("fragId", idList[i]);
			DBCursor cursor = coll.find(query);
			String str;

			if (cursor.hasNext()) {
				BasicDBObject obj = (BasicDBObject) cursor.next();
				HashMap<String, String> frag = new HashMap<String,String>();
				//System.out.println (obj);

				if ( type.equals("tb") ){  // Get thumbnail images
					str = obj.getString("tb");

					if (str != null) {
						/*
        				byte[] byteString = str.getBytes();
        				String hexString = Hex.encodeHex(byteString).toString();
        				System.out.println (hexString);
						 */

						frag.put("id", idList[i]);
						frag.put("tb", str);
						fragList.add (frag);
					}
				}
				else { // get regular fragments

					str = obj.getString("frags");

					if (str != null) {
						/*
        				byte[] byteString = str.getBytes();
        				String hexString = Hex.encodeHex(byteString).toString();
        				System.out.println (hexString);
						 */

						frag.put("id", idList[i]);
						frag.put("frag", str);
						fragList.add (frag);
					}

				}
 		   }
		}
	}
	catch (Exception e) {
		e.printStackTrace();
	 }
	Gson gson = new Gson();
	return gson.toJson(fragList);
}


@Profiled(tag = "GetContentContentUrls_{$0}")
final public String GetContentContentUrls(final String token, final String type) {

		DBCollection coll = connectMongoDB().getCollection("url_loc");
		BasicDBObject query = new BasicDBObject();
		//System.out.println("type="+type);

		query.put("type",type);

		DBCursor cursor = coll.find(query);
		String urlString = null;
		HashMap<String, String> urlMap = new HashMap<String,String>();

		while (cursor.hasNext()) {
			BasicDBObject obj = (BasicDBObject) cursor.next();

			urlString = obj.getString("base");
			System.out.println("base url="+urlString);
			urlMap.put("base", urlString);
		}

		Gson gson = new Gson();
		return gson.toJson(urlMap);
	}

@Profiled (tag = "GetWordDef_{$0}")
final public String GetWordDef (String version, String aWord) {

		DBCollection coll = connectMongoDB().getCollection("dict");
		HashMap<String, String> urlMap = new HashMap<String,String>();

		System.out.println(coll.findOne());
		String searchWord=aWord.toLowerCase();

		DBCursor cursor = coll.find(new BasicDBObject("orig", searchWord));

		String wordOrig = null;
		System.out.println("word="+searchWord);

		while (cursor.hasNext()) {
			BasicDBObject obj = (BasicDBObject) cursor.next();
			wordOrig = obj.getString("orig");
			System.out.println("orig="+wordOrig);
			String wordUrl = "/Dictionary" + wordOrig + '/' + version.toUpperCase() + '/'+ wordOrig + ".html";
			urlMap.put("wordurl", wordUrl);
			 //wordVersion = obj.getString("ver");
		}

		Gson gson = new Gson();
		return gson.toJson(urlMap);
	}


@Profiled (tag = "GetWordDyn_{$0}")
final public String GetWordDyn (String version, String aWord) {
		HashMap<String, String> defMap = new GetNewWords(connectMongoDB()).getDefinition(version, aWord, true);
		Gson gson = new GsonBuilder().disableHtmlEscaping().create();

String gsonDef = gson.toJson(defMap);
System.out.println("word = " + aWord + " def = [" + gsonDef + "]");

		return gson.toJson(defMap);
	}

@Profiled (tag = "GetWordDyn2_{$0}")
final public String GetWordDyn2 (String version, String aWord) {
		String def = "<html><body>Definition for " + aWord + " (" + version + ") not found</body></html>";
		HashMap<String, String> defMap = new GetNewWords(connectMongoDB()).getDefinition(version, aWord, true);
		if (defMap != null)
		{
			String str = defMap.get("definition");
			if (str != null && !str.isEmpty())
				def = str;
		}
		System.out.println("word = " + aWord + " def = [" + def + "]");

		return def;
	}

@Profiled (tag = "GetWordsByBookList_{$0}")
final public String GetWordsByBookList (String version, String elist, String nlist) {

		ArrayList<HashMap<String,String>> defList = new GetNewWords(connectMongoDB()).getNewWords(version, elist, nlist, true);

		Gson gson = new GsonBuilder().disableHtmlEscaping().create();
		return gson.toJson(defList);
	}

@Profiled (tag = "GetWordsByBookList2_{$0}")
final public String GetWordsByBookList2 (String version, String elist, String nlist) {

		ArrayList<HashMap<String,String>> defList = new GetNewWords(connectMongoDB()).getNewWords(version, elist, nlist, false);

		Gson gson = new GsonBuilder().disableHtmlEscaping().create();
		return gson.toJson(defList);
	}

@Profiled (tag = "GetAllWords_{$0}")
final public String GetAllWords (String version) {
		ArrayList<HashMap<String,String>> defList =  new GetNewWords(connectMongoDB()).getAllWords(version, true);

		Gson gson = new GsonBuilder().disableHtmlEscaping().create();
		return gson.toJson(defList);
	}


@Profiled (tag = "GetWordForms_{$0}")
final public String GetWordForms () {
		ArrayList<HashMap<String,String>> wordformList =  new GetNewWords(connectMongoDB()).getWordForms();

		Gson gson = new GsonBuilder().disableHtmlEscaping().create();
		return gson.toJson(wordformList);
	}


}