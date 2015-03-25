package com.scholastic.ereader;
import java.util.*;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.BasicDBObject;
import com.mongodb.DBCursor;
import com.mongodb.DBObject;
import com.mongodb.QueryBuilder;

//Get thumbnail image of Content
public class GetNewWords {
	private DB mdb;

	GetNewWords (DB db)
	{
		mdb = db;
	}

	// This is what one word definition looks like
	private HashMap<String, String>  makeDefinition(BasicDBObject obj, boolean withDef)
	{
		HashMap<String, String> def = new HashMap<String,String>();

		String id = obj.getString("dictId");
		String yo = obj.getString("yo");
		String word = obj.getString("word");
//System.out.println("Def=[" + definition + "]");
		def.put("id", id);
		def.put("word", word);
		def.put("version", yo);
		if (withDef)
		{	
			String definition = obj.getString("def");
			def.put("definition", definition);
		}
		else
		{
			def.put("definition", "");
		}

		return def;
	}


	// This is what one wordform looks like
	private HashMap<String, String>  makeWordform(BasicDBObject obj)
	{
		HashMap<String, String> wordformObj = new HashMap<String,String>();

		String wordform = obj.getString("wordform");
		String word = obj.getString("word");
		String yo = obj.getString("yo");
		String id = obj.getString("dictId");

		wordformObj.put("wordform", wordform);
		wordformObj.put("word", word);
		wordformObj.put("id", id);
		wordformObj.put("version", yo);

		return wordformObj;
	}


	public HashMap<String, String>  getDefinition(String version, String aWord, boolean withDef)
	{
//System.out.println("getDefinition BEGIN, v=" + version + ", word=" + aWord);
		DBCollection coll = mdb.getCollection("dictionary");

		DBCursor cursor = coll.find(new BasicDBObject("word", aWord).append("yo", version));

		if (cursor.hasNext()) {
			BasicDBObject obj = (BasicDBObject) cursor.next();
			return makeDefinition(obj, withDef);
		}
//System.out.println("getDefinition END");
		return new HashMap<String,String>();
	}


	public ArrayList<HashMap<String,String>>  getAllWords(String version, boolean withDef)
	{
		DBCollection coll = mdb.getCollection("dictionary");
		ArrayList<HashMap<String,String>> defList = new ArrayList<HashMap<String,String>>();

		DBCursor cursor = coll.find(new BasicDBObject("yo", version));	// TODO: Add index on "yo" only if we keep this functionality

		while (cursor.hasNext()) {
			BasicDBObject obj = (BasicDBObject) cursor.next();
			defList.add(makeDefinition(obj, true));
		}

		return defList;
	}

	public ArrayList<HashMap<String,String>>  getNewWords(String version, String existingIsbnList, String newIsbnList, boolean withDef)
	{
		ArrayList<HashMap<String,String>> defList = new ArrayList<HashMap<String,String>>();

		try {
								// should this take version?
System.out.println("getNewWords Begin, version=" + version + ", existingIsbnList= " + existingIsbnList + ", newIsbnList=" + newIsbnList + ", withDef=" + withDef);
			if (existingIsbnList != null)
				existingIsbnList.trim();
			if (newIsbnList != null)
				newIsbnList.trim();
			String newWords[] =  getNewWords(existingIsbnList!=null?existingIsbnList.split(","):null, newIsbnList!=null?newIsbnList.split(","):null);
System.out.println("newword count = " + (newWords!=null?newWords.length:0));
//for (int w = 0; newWords!=null && w < newWords.length; w++)
//	System.out.println("\t word[" + w + "]=" + newWords[w]);

			if (newWords == null || newWords.length == 0)
				return defList;

			// One word requested at a time:  Much FASTER than All words in one giant "in (...)"
			ArrayList<HashMap<String,String>> defList2 = new ArrayList<HashMap<String,String>>();
			defList2 = buildWordDefs2(defList2, version, newWords, withDef);
System.out.println("defList2 count = " + (defList2!=null?defList2.size():0));

			// All words requested as one giant "in (...)" statement
			/* WAY SLOWER
			ArrayList<HashMap<String,String>> defList1 = new ArrayList<HashMap<String,String>>();
			defList1 = buildWordDefs1(defList1, version, newWords, withDef);
System.out.println("defList1 count = " + (defList1!=null?defList1.size():0));
			*/

// Sample timings
/*
 * isbn_9780545035255, OD, after db restart:  Over 40 seconds for ALL words, and < 1 second for one-by-one
 *  12:36:48,555 INFO  [stdout] (http-localhost-127.0.0.1-8080-1) newword count = 3282
 *  12:37:30,067 INFO  [stdout] (http-localhost-127.0.0.1-8080-1) defList1 count = 1581
 *  12:37:30,692 INFO  [stdout] (http-localhost-127.0.0.1-8080-1) defList2 count = 1581
 *
 */

/* Even with reverse order, one-by-one much faster
 * isbn_9780545035255, OD, after db restart: (<) 1 second for one-by-one, and (>) 35 seconds for ALL words
 *  12:41:43,327 INFO  [stdout] (http-localhost-127.0.0.1-8080-1) newword count = 3282
 *  12:41:44,279 INFO  [stdout] (http-localhost-127.0.0.1-8080-1) defList2 count = 1581
 *  12:42:21,080 INFO  [stdout] (http-localhost-127.0.0.1-8080-1) defList1 count = 1581
 *
 */
			defList = defList2;
System.out.println("getNewWords End");
		}
		catch (Exception e)
		{
			e.printStackTrace();
		}

		return defList;
	}

	// All words requested as one giant "in (...)" statement     NOTE: SLOW with 1581/3282 results
	private ArrayList<HashMap<String,String>>  buildWordDefs1(ArrayList<HashMap<String,String>> defList, String version, String words[], boolean withDef)
	{
		DBCollection coll = mdb.getCollection("dictionary");

//		DBObject wordsDefQuery = new QueryBuilder().put("word").in(words).and(new BasicDBObject("yo", version)).get();
		DBObject wordsDefQuery = new QueryBuilder().put("word").in(words).get();

		DBCursor cursor = coll.find(wordsDefQuery);

		while (cursor.hasNext()) {
			BasicDBObject obj = (BasicDBObject) cursor.next();

			String yo = obj.getString("yo");
			if (yo != null && yo.compareTo(version) == 0)
				defList.add(makeDefinition(obj, withDef));
		}

		return defList;
	}

	// Call base method with one word requested at a time.
	private ArrayList<HashMap<String,String>>  buildWordDefs2(ArrayList<HashMap<String,String>> defList, String version, String words[], boolean withDef)
	{
		for (int w = 0; words != null && w < words.length; w++)
		{
			HashMap<String, String> def = getDefinition(version, words[w], withDef);
			if (def != null && !def.isEmpty())
				defList.add(def);
		}
		return defList;
	}

	// This method assumes each isbn has it's own isbn_####_words table/collection.
	private String[] getNewWords(String[] existingIsbnList, String[] newIsbnList)
	{
		HashMap<String, String> existingWords = new HashMap<String, String>();
		for (int e = 0; existingIsbnList != null && e < existingIsbnList.length; e++)
		{
			DBCollection isbnColl;
			String collectionName = existingIsbnList[e] + "_words";
			try
			{
				isbnColl = mdb.getCollection(collectionName);
			}
			catch (Exception ex)
			{
				System.out.println("No word table for existingIsbn = " + existingIsbnList[e]);
				continue;
			}
			DBCursor dbCur = isbnColl.find();
			while (dbCur.hasNext()) {
				BasicDBObject obj = (BasicDBObject) dbCur.next();
				String word = obj.getString("word");
				if (!existingWords.containsKey(word))
					existingWords.put(word, null);
			}
			dbCur.close();
		}

		HashMap<String, String> newWords = new HashMap<String, String>();
		for (int n = 0; newIsbnList != null && n < newIsbnList.length; n++)
		{
			DBCollection isbnColl;
			String collectionName = newIsbnList[n] + "_words";
			try
			{
				isbnColl = mdb.getCollection(collectionName);
			}
			catch (Exception ex)
			{
				System.out.println("No word table for newIsbn = " + newIsbnList[n]);
				continue;
			}

			DBCursor dbCur = isbnColl.find();
			while (dbCur.hasNext()) {
				BasicDBObject obj = (BasicDBObject) dbCur.next();
				String word = obj.getString("word");
				if (!existingWords.containsKey(word) && !newWords.containsKey(word))
					newWords.put(word, null);
			}
			dbCur.close();
		}

		// return makeArray(newWords.keySet());
		Set<String> newWordSet = newWords.keySet();
		if (newWordSet.isEmpty())
			return null;

		String words[] = new String[newWordSet.size()];
		Iterator<String> it = newWordSet.iterator();
		int w = 0;
		while (it.hasNext())
		{
			words[w++] = (String)it.next();
		}
		return words;
	}



	public ArrayList<HashMap<String,String>>  getWordForms()
	{
System.out.println("getWordForms BEGIN");
		DBCollection coll = mdb.getCollection("dictform");
		ArrayList<HashMap<String,String>> wordformList = new ArrayList<HashMap<String,String>>();

		DBCursor cursor = coll.find();

		while (cursor.hasNext()) {
			BasicDBObject obj = (BasicDBObject) cursor.next();
			wordformList.add(this.makeWordform(obj));
		}
System.out.println("getWordForms END, returning " + (wordformList == null?0:wordformList.size()) + " wordforms.");
		return wordformList;
	}


}
