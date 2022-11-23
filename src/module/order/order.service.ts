import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartService } from '../cart/cart.service';
import { Cart } from '../cart/entity/cart.entity';
import { User } from '../user/entity/user.entity';
import { Order } from './entity/order.entity';
import { Payment } from './entity/payment.entity';
import { Status } from './enum/status.enum';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(Cart) private cartRepository: Repository<Cart>,
    private cartService: CartService,
  ) {}

  private readonly logger = new Logger();

  // check all order deadline
  @Cron(CronExpression.EVERY_HOUR)
  async deadlineCheck() {
    this.logger.log('Checking Order deadline...');

    const orders = await this.orderRepository.find();

    if (!orders.length) return;

    orders
      .filter((order) => order.deadline !== null)
      .map((order) => {
        let now = new Date();
        let deadline = order.deadline;

        if (deadline.getTime() < now.getTime()) {
          order.status = Status.FAIL;
          order.deadline = null;
          this.orderRepository.softRemove(order);
        }
      });
  }

  getAllOrder() {
    return this.orderRepository.find({
      relations: ['user'],
      withDeleted: true,
    });
  }

  async getUserOrder(userId: string) {
    const orders = await this.getAllOrder();

    return orders.filter((order) => {
      order.user.id === userId;
      delete order.user;
      return order;
    });
  }

  async getAllOrderPayment() {
    return await this.paymentRepository.find({ relations: ['order'] });
  }

  async createOrder(user: User) {
    const items = user.carts;
    const totalPrice = await this.cartService.calculateCarts(user.id);

    const newOrder = this.orderRepository.create({
      user,
      totalPrice,
      items,
    });

    // delete user carts
    this.cartRepository.remove(items);

    return await this.orderRepository.save(newOrder);
  }

  async updateStatus(id: string, status: Status) {
    await this.orderRepository.update(
      { id },
      { status: status, deadline: null },
    );

    return {
      message: 'Update success!',
    };
  }

  async deleteOrder(id: string) {
    await this.orderRepository.softDelete(id);

    return { message: 'Delete success!' };
  }

  async acceptOrder(id: string) {
    // update user order
    await this.updateStatus(id, Status.ONQUEUE);

    return { message: 'Success!' };
  }

  async rejectOrder(id: string) {
    await this.updateStatus(id, Status.FAIL);

    // soft delete user order
    this.deleteOrder(id);

    return { message: 'Success!' };
  }

  async uploadFileBuffer(order: Order, fileBuffer: Buffer) {
    const newPayment = this.paymentRepository.create({
      order,
      data: fileBuffer,
    });

    await this.paymentRepository.save(newPayment);
    return newPayment;
  }

  async uploadPaymentFile(orderId: string, fileBuffer: Buffer) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['payment'],
    });
    const payment = await this.uploadFileBuffer(order, fileBuffer);

    await this.orderRepository.update(
      { id: order.id },
      { payment, deadline: null, status: Status.PENDING },
    );

    return { message: 'Upload success!' };
  }
}
