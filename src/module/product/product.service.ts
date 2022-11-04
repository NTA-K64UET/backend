import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Category } from '../category/entity/category.entity';
import {
  CreateProductDetailsDto,
  CreateProductDto,
  UpdateProductDetailsDto,
  UpdateProductDto,
} from './dto';
import { Details } from './entity/details.entity';
import { Products } from './entity/product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Products) private productRepository: Repository<Products>,
    @InjectRepository(Details) private detailsRepository: Repository<Details>,
  ) {}
  async create(createProductDto: CreateProductDto, category: Category) {
    const newProduct = await this.productRepository.save(createProductDto);

    category.products = [...category.products, newProduct];
    await this.categoryRepository.save(category);

    return newProduct;
  }

  findAllProducts() {
    return this.productRepository.find({
      order: { id: 'ASC' },
      relations: ['category', 'details'],
    });
  }

  async filterProducts(search: string, price: any) {
    const products = await this.productRepository.find({
      relations: ['category', 'details'],
      where: search ? { product_name: ILike(`%${search}%`) } : null,
      order: price ? { price: `${price}` } : null,
    });

    if (!products.length) throw new NotFoundException('Product Not Found');
    return products;
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'details'],
    });

    if (!product)
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);

    return product;
  }

  async update(
    id: string,
    { product_name, stock, price, category_id }: UpdateProductDto,
  ) {
    const product = await this.findOne(id);
    const category = await this.categoryRepository.findOne({
      where: { id: category_id },
      relations: ['products'],
    });

    product.product_name = product_name;
    product.stock = stock;
    product.price = price;
    product.category = category;

    return await this.productRepository.save(product);
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
    return `Product with id: ${id} has deleted`;
  }

  getAllDetails() {
    return this.detailsRepository.find({
      relations: ['product'],
      order: { id: 'ASC' },
    });
  }

  async createProductDetails(dto: CreateProductDetailsDto, product: Products) {
    const details = await this.detailsRepository.save(dto);

    product.details = details;
    await this.productRepository.save(product);

    return details;
  }

  async updateProductDetails(id: string, dto: UpdateProductDetailsDto) {
    const details = await this.detailsRepository.findOne({
      where: { id },
      relations: ['product'],
    });
    const product = await this.findOne(dto.product_id);

    details.product = product;

    return await this.detailsRepository.save(details);
  }
}
