## To-do List


### Version 0.3.5 (Security)
* [ ] Additional Security
  * [ ] Express Security Best Practices (TLS, etc...)

### Version 0.3.0 (Fun Features)
* [x] Trash Functionality
  * Each Item would have a **Deleted** State and Date Deleted
* [x] Internal Caching
  * Fewer Database Requests if data not Modified
  * Internal State for DB Data
* [x] Interval Cache Checker
  * Completly Remove the Item from DB after N-Days (**Check on Intervals based on Cache**)
    * Implement AFTER Caching
* [x] Cookies

### Version 0.2.5 (Security)
* [x] More Secure CORS Origin
* [x] Additional Security
  * [x] Request Limiter (`express-rate-limit`)
