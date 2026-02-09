import { Router, Request, Response } from "express";
import { categoryService } from "../services/category-service";

export class CategoriesController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get("/", this.getAllCategories);
    this.router.get("/:id", this.getCategoryById);
  }

  private getAllCategories = async (req: Request, res: Response) => {
    try {
      const categories = await categoryService.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Categories API error:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  };

  private getCategoryById = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

      const category = await categoryService.getCategoryById(id);
      if (!category) return res.status(404).json({ error: "Category not found" });

      res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ error: "Failed to fetch category" });
    }
  };
}

export const categoriesController = new CategoriesController();
