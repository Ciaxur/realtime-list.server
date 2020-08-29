## To-do List

### Version 0.3.0 (Fun Features)
* [x] Trash Functionality
  * Each Item would have a **Deleted** State and Date Deleted
* [ ] Internal Caching
  * Fewer Database Requests if data not Modified
  * Internal State for DB Data
* [ ] Interval Cache Checker
  * Completly Remove the Item from DB after N-Days (**Check on Intervals based on Cache**)
    * Implement AFTER Caching
* [ ] Cookies

### Version 0.2.5 (Security)
* [x] More Secure CORS Origin
* [ ] Additional Security
  * [x] Request Limiter (`express-rate-limit`)
  * [ ] Express Security Best Practices (TLS, etc...)

