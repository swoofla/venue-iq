/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminBudgetEstimates from './pages/AdminBudgetEstimates';
import AdminCalendar from './pages/AdminCalendar';
import AdminPhotos from './pages/AdminPhotos';
import AdminVisualizerSettings from './pages/AdminVisualizerSettings';
import AdminWeddings from './pages/AdminWeddings';
import Dashboard from './pages/Dashboard';
import FirstLookEmbed from './pages/FirstLookEmbed';
import Home from './pages/Home';
import Invite from './pages/Invite';
import MaskGenerator from './pages/MaskGenerator';
import QuoteSummary from './pages/QuoteSummary';
import Register from './pages/Register';
import SuperAdmin from './pages/SuperAdmin';
import VenueSettings from './pages/VenueSettings';


export const PAGES = {
    "AdminBudgetEstimates": AdminBudgetEstimates,
    "AdminCalendar": AdminCalendar,
    "AdminPhotos": AdminPhotos,
    "AdminVisualizerSettings": AdminVisualizerSettings,
    "AdminWeddings": AdminWeddings,
    "Dashboard": Dashboard,
    "FirstLookEmbed": FirstLookEmbed,
    "Home": Home,
    "Invite": Invite,
    "MaskGenerator": MaskGenerator,
    "QuoteSummary": QuoteSummary,
    "Register": Register,
    "SuperAdmin": SuperAdmin,
    "VenueSettings": VenueSettings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};