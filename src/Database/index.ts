// Database Libraries
import * as firebase from 'firebase/app';
import 'firebase/database';


export class FirebaseInstance {
  private static instance: FirebaseInstance = null;
  private db: firebase.database.Database;
  
  // SINGLETON
  private constructor() {
    this.init();
  }

  // CREATE/INIT
  private init() {
    const firebaseConfig = {
      apiKey: process.env.apiKey,
      authDomain: process.env.authDomain,
      databaseURL: process.env.databaseURL,
      projectId: process.env.projectId,
      storageBucket: process.env.storageBucket,
      messagingSenderId: process.env.messagingSenderId,
      appId: process.env.appId,
      measurementId: process.env.measurementId,
    };
    firebase.initializeApp(firebaseConfig);
    this.db = firebase.database();
  }

  /**
   * Creates a Firebase Singleton Instance
   * @returns Firebase Instance
   */
  public static createDatabase(): FirebaseInstance {
    if (this.instance === null) {
      this.instance = new FirebaseInstance();
    }
    return this.instance;
  }

  /**
   * Returns the only database object, creating one if no instance
   *  is created yet
   */
  public static getDatabase(): firebase.database.Database {
    const instance = this.createDatabase();
    return instance.db;
  }
}
