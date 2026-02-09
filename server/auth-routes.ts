/**
 * Authentication routes for user management
 */
import { Router } from "express";
import { registerSchema, loginSchema, isAuthenticated } from "./auth";
import * as userService from "./services/user-service";
import * as recommendationService from "./services/recommendation";

const router = Router();

// Register a new user
router.post("/register", async (req, res) => {
  try {
    // Validate request body
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    // Register the user
    const userData = validation.data;
    const user = await userService.createUser({
      email: userData.email,
      password: userData.password,
      name: userData.name,
      profileImage: userData.profileImage,
    });

    // Create default preferences
    await userService.createUserPreferences({
      userId: user.id,
      categories: [],
      keywords: [],
      authors: [],
      emailNotifications: true,
      notificationFrequency: "weekly",
    });

    // Set session
    req.session.userId = user.id;

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error: any) {
    if (error.message === "Email is already registered") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Registration error:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
});

// Login a user
router.post("/login", async (req, res) => {
  try {
    // Validate request body
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    // Authenticate the user
    const { email, password } = validation.data;
    const user = await userService.authenticateUser(email, password);

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Set session
    req.session.userId = user.id;

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Failed to login" });
  }
});

// Logout a user
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

// Get current user
router.get("/me", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await userService.getUserById(userId!);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Failed to get current user" });
  }
});

// Update user profile
router.put("/profile", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await userService.updateUser(userId!, req.body);

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Get user preferences
router.get("/preferences", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const preferences = await userService.getUserPreferences(userId!);

    if (!preferences) {
      // Create default preferences if not found
      const newPreferences = await userService.createUserPreferences({
        userId: userId!,
        categories: [],
        keywords: [],
        authors: [],
        emailNotifications: true,
        notificationFrequency: "weekly",
      });

      return res.json(newPreferences);
    }

    res.json(preferences);
  } catch (error) {
    console.error("Get preferences error:", error);
    res.status(500).json({ message: "Failed to get preferences" });
  }
});

// Update user preferences
router.put("/preferences", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const preferences = await userService.getUserPreferences(userId!);

    if (!preferences) {
      // Create preferences if not found
      const newPreferences = await userService.createUserPreferences({
        userId: userId!,
        ...req.body,
      });

      // Refresh recommendations
      await recommendationService.refreshUserRecommendations(userId!);

      return res.json(newPreferences);
    }

    // Update existing preferences
    const updatedPreferences = await userService.updateUserPreferences(
      preferences.id,
      req.body,
    );

    // Refresh recommendations
    await recommendationService.refreshUserRecommendations(userId!);

    res.json(updatedPreferences);
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({ message: "Failed to update preferences" });
  }
});

// Get recommended studies
router.get("/recommended/studies", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    // Ensure limit is a valid number
    if (isNaN(limit)) {
      return res.status(400).json({ message: "Invalid limit parameter" });
    }

    const studies = await recommendationService.getRecommendedStudies(
      Number(userId),
      limit,
    );
    res.json(studies);
  } catch (error) {
    console.error("Get recommended studies error:", error);
    res.status(500).json({ message: "Failed to get recommended studies" });
  }
});

// Get recommended blogs
router.get("/recommended/blogs", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    // Ensure limit is a valid number
    if (isNaN(limit)) {
      return res.status(400).json({ message: "Invalid limit parameter" });
    }

    const blogs = await recommendationService.getRecommendedBlogs(
      Number(userId),
      limit,
    );
    res.json(blogs);
  } catch (error) {
    console.error("Get recommended blogs error:", error);
    res.status(500).json({ message: "Failed to get recommended blogs" });
  }
});

// Save a study
router.post("/studies/:id/save", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const studyId = parseInt(req.params.id);
    // Ensure studyId is a valid number
    if (isNaN(studyId)) {
      return res.status(400).json({ message: "Invalid study ID" });
    }

    const interaction = await userService.saveStudy(Number(userId), studyId);
    res.json({ message: "Study saved successfully", isSaved: true });
  } catch (error) {
    console.error("Save study error:", error);
    res.status(500).json({ message: "Failed to save study" });
  }
});

// Unsave a study
router.delete("/studies/:id/save", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const studyId = parseInt(req.params.id);
    // Ensure studyId is a valid number
    if (isNaN(studyId)) {
      return res.status(400).json({ message: "Invalid study ID" });
    }

    await userService.unsaveStudy(Number(userId), studyId);
    res.json({ message: "Study unsaved successfully", isSaved: false });
  } catch (error) {
    console.error("Unsave study error:", error);
    res.status(500).json({ message: "Failed to unsave study" });
  }
});

// Record study view
router.post("/studies/:id/view", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const studyId = parseInt(req.params.id);
    // Ensure studyId is a valid number
    if (isNaN(studyId)) {
      return res.status(400).json({ message: "Invalid study ID" });
    }

    await userService.recordStudyView(Number(userId), studyId);
    res.json({ message: "Study view recorded" });
  } catch (error) {
    console.error("Record study view error:", error);
    res.status(500).json({ message: "Failed to record study view" });
  }
});

// Get saved studies
router.get("/studies/saved", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const studies = await userService.getSavedStudies(Number(userId));
    res.json(studies);
  } catch (error) {
    console.error("Get saved studies error:", error);
    res.status(500).json({ message: "Failed to get saved studies" });
  }
});

// Get recently viewed studies
router.get("/studies/recent", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    // Ensure limit is a valid number
    if (isNaN(limit)) {
      return res.status(400).json({ message: "Invalid limit parameter" });
    }

    const studies = await userService.getRecentlyViewedStudies(
      Number(userId),
      limit,
    );
    res.json(studies);
  } catch (error) {
    console.error("Get recent studies error:", error);
    res.status(500).json({ message: "Failed to get recent studies" });
  }
});

// Similar routes for blog interactions
router.post("/blogs/:id/save", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const blogId = parseInt(req.params.id);
    // Ensure blogId is a valid number
    if (isNaN(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const interaction = await userService.saveBlog(Number(userId), blogId);
    res.json({ message: "Blog saved successfully", isSaved: true });
  } catch (error) {
    console.error("Save blog error:", error);
    res.status(500).json({ message: "Failed to save blog" });
  }
});

router.delete("/blogs/:id/save", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const blogId = parseInt(req.params.id);
    // Ensure blogId is a valid number
    if (isNaN(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    await userService.unsaveBlog(Number(userId), blogId);
    res.json({ message: "Blog unsaved successfully", isSaved: false });
  } catch (error) {
    console.error("Unsave blog error:", error);
    res.status(500).json({ message: "Failed to unsave blog" });
  }
});

router.post("/blogs/:id/view", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const blogId = parseInt(req.params.id);
    // Ensure blogId is a valid number
    if (isNaN(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    await userService.recordBlogView(Number(userId), blogId);
    res.json({ message: "Blog view recorded" });
  } catch (error) {
    console.error("Record blog view error:", error);
    res.status(500).json({ message: "Failed to record blog view" });
  }
});

router.get("/blogs/saved", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const blogs = await userService.getSavedBlogs(userId!);
    res.json(blogs);
  } catch (error) {
    console.error("Get saved blogs error:", error);
    res.status(500).json({ message: "Failed to get saved blogs" });
  }
});

router.get("/blogs/recent", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    // Ensure userId is a valid number
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    // Ensure limit is a valid number
    if (isNaN(limit)) {
      return res.status(400).json({ message: "Invalid limit parameter" });
    }

    const blogs = await userService.getRecentlyViewedBlogs(
      Number(userId),
      limit,
    );
    res.json(blogs);
  } catch (error) {
    console.error("Get recent blogs error:", error);
    res.status(500).json({ message: "Failed to get recent blogs" });
  }
});

// Notification routes
router.get("/notifications", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const unreadOnly = req.query.unread === "true";

    const notifications = await userService.getUserNotifications(
      userId!,
      unreadOnly,
    );
    res.json(notifications);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Failed to get notifications" });
  }
});

router.put("/notifications/:id/read", isAuthenticated, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);

    await userService.markNotificationAsRead(notificationId);
    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Mark notification error:", error);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
});

router.put("/notifications/read-all", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    await userService.markAllNotificationsAsRead(userId!);
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications error:", error);
    res
      .status(500)
      .json({ message: "Failed to mark all notifications as read" });
  }
});

// Search history
router.post("/search-history", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { searchQuery } = req.body;

    if (!searchQuery) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const searchRecord = await userService.addSearchHistory({
      userId: userId!,
      searchQuery,
    });

    res.json(searchRecord);
  } catch (error) {
    console.error("Add search history error:", error);
    res.status(500).json({ message: "Failed to add search history" });
  }
});

router.get("/search-history", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const searchHistory = await userService.getUserSearchHistory(
      userId!,
      limit,
    );
    res.json(searchHistory);
  } catch (error) {
    console.error("Get search history error:", error);
    res.status(500).json({ message: "Failed to get search history" });
  }
});

export default router;
