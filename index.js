const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_sk)

// middle wares
app.use(cors());
app.use(express.json());


// Mongodb url
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zzty5cj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// connect mongodb
const dbConnect = async () => {
    try {
        await client.connect();
        console.log('Database connected');
    } catch (error) {
        console.log(error)
    }
};
dbConnect();


// verify jwt
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }

        req.decode = decode;
        next();
    })
}

// Database collection
const Categories = client.db('Best-buy').collection('products-category');
const Products = client.db('Best-buy').collection('products');
const Users = client.db('Best-buy').collection('users');
const Bookings = client.db('Best-buy').collection('bookings');
const Payments = client.db('Best-buy').collection('payments');
const WishList = client.db('Best-buy').collection('wishlist');
const DeletedUser = client.db('Best-buy').collection('deleted-user');
const Advertise = client.db('Best-buy').collection('advertise');
const Reviews = client.db('Best-buy').collection('reviews');


app.get('/', (req, res) => {
    res.send('API is running');
});

// Get All categories
app.get('/productCategory', async (req, res) => {
    try {
        const categories = await Categories.find({}).toArray();
        res.send({
            success: true,
            message: "Successfully got the categories",
            data: categories
        })
    } catch (error) {
        console.log(error)
        res.send({
            success: false,
            error: error.message
        })
    }
});



// Get product by category
app.get('/productCategory', async (req, res) => {
    try {
        const categories = await Categories.find({}).toArray();
        res.send({
            success: true,
            message: "Successfully got the categories",
            data: categories
        })
    } catch (error) {
        console.log(error)
        res.send({
            success: false,
            error: error.message
        })
    }
});



// Get all Products
app.get('/products', async (req, res) => {
    try {
        const { page, size } = req.query;
        const products = await Products.find({}).skip(page * size).limit(parseInt(size)).toArray();
        const productsCount = await Products.estimatedDocumentCount();
        res.send({
            success: true,
            message: 'Successfully got the products',
            data: { products, productsCount }
        })
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})

// Get products by brand name
app.get('/products/:brand', async (req, res) => {
    try {
        const brand = req.params.brand;
        const query = { productCategory: brand }
        const products = await Products.find(query).toArray();
        res.send({
            success: true,
            message: 'Successfully got the products',
            data: products
        })
    } catch (error) {
        console.log(error)
        res.send({
            success: false,
            error: error.message
        })
    }
});


// get product by id
app.get('/product/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Products.findOne({ _id: ObjectId(id) });
        res.send({
            success: true,
            message: 'Successfully got the products',
            data: product
        })
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})



// Post A product
app.post('/products', async (req, res) => {
    try {
        const product = req.body;
        const result = await Products.insertOne(product);
        if (result.insertedId) {
            res.send({
                success: true,
                message: 'Successfully insert the product',
                data: result
            })
        } else {
            res.send({
                success: false,
                message: 'Could not insert the product'
            })
        }
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})


app.get('/user', verifyJWT, async (req, res) => {
    try {
        const email = req.query.email;
        const decodedEmail = req.decode.email;

        if (email !== decodedEmail) {
            return res.status(403).send({ message: 'forbidden access' })
        }

        const query = { email: email };
        const user = await Users.findOne(query);
        res.send({
            success: true,
            message: 'Successfully find the user',
            data: user
        })

    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})

app.post('/users', async (req, res) => {
    try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);

        const isDeleted = await DeletedUser.findOne({ email: user?.email })
        const hasUser = await Users.findOne({ email: user?.email });

        if (isDeleted) {
            return res.send({ message: 'your account is deleted' })
        }

        if (hasUser) {
            return res.send({ token })
        };

        const result = await Users.insertOne(user);
        if (result.insertedId) {
            res.send({
                success: true,
                token: token
            })
        }
    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})



// Deleted user
app.post('/deleteUsers', verifyJWT, async (req, res) => {
    try {
        const email = req.query.email;
        const decodedEmail = req.decode.email;

        if (email !== decodedEmail) {
            return res.status(403).send({ message: 'forbidden access' })
        }

        // post/store deleted user
        const user = req.body;
        const result = await DeletedUser.insertOne(user);

        // delete user
        const deletedUserEmail = user.email;
        const query = { email: deletedUserEmail };
        const deleteUser = await Users.deleteOne(query);


        if (result.insertedId && deleteUser.deletedCount) {
            res.send({
                success: true,
                message: 'Successfully insert',
                data: result
            })
        } else {
            res.send({
                success: false,
                message: 'Could not insert'
            })
        }
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
});



app.get('/bookings', verifyJWT, async (req, res) => {
    try {
        const email = req.query.email;
        const decodedEmail = req.decode.email;

        if (email !== decodedEmail) {
            return res.status(403).send({ message: 'Forbidden access' })
        }

        const query = { customerEmail: email };
        const bookings = await Bookings.find(query).toArray();
        res.send({
            success: true,
            message: 'Successfully got the bookings',
            data: bookings
        })

    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})


app.post('/bookings', async (req, res) => {
    try {
        const bookingData = req.body;
        const id = bookingData.productId;
        // Delete form advertise
        const query = { _id: id }
        const deleteAds = await Advertise.deleteOne(query);
        const result = await Bookings.insertOne(bookingData);

        if (result.insertedId) {
            res.send({
                success: true,
                message: 'successfully insert the booking',
                data: result
            })
        } else {
            res.send({
                success: false,
                message: 'could not insert the booking'
            })
        }
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})


app.get('/allSellers', verifyJWT, async (req, res) => {
    try {
        const query = { role: 'seller' };
        const sellers = await Users.find(query).toArray();
        res.send({
            success: true,
            message: 'Successfully got the all sellers',
            data: sellers
        })
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})



// update sellers as a admin
app.put('/allSellers', verifyJWT, async (req, res) => {
    try {
        const seller = req.body;
        const query = { _id: ObjectId(seller._id) };
        const updatedDoc = {
            $set: {
                role: 'admin'
            }
        };

        const result = await Users.updateOne(query, updatedDoc, { upsert: true });
        if (result.modifiedCount) {
            res.send({
                success: true,
                message: 'Successfully updated seller rule',
                data: result
            })
        } else {
            res.send({
                success: false,
                message: "Could not update seller role"
            })
        }
    } catch (error) {
        console.log(error);
        res.send({
            success: true,
            error: error.message
        })
    }
})

// Get all admin
app.get('/admin', verifyJWT, async (req, res) => {
    try {
        const email = req.query.email;
        const decodedEmail = req.decode.email;

        if (email !== decodedEmail) {
            return res.status(403).send({ message: "Forbidden access" });
        }

        const query = { role: 'admin' };
        const admin = await Users.find(query).toArray();
        res.send({
            success: true,
            message: 'Successfully got the all admin',
            data: admin
        })
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})

// Get all users or buyers
app.get('/allBuyers', verifyJWT, async (req, res) => {
    try {
        const email = req.query.email;
        const decodedEmail = req.decode.email;

        if (email !== decodedEmail) {
            return res.status(403).send({ message: "Forbidden access" });
        }

        const query = { role: 'user' };
        const buyers = await Users.find(query).toArray();
        res.send({
            success: true,
            message: 'Successfully got the all sellers',
            data: buyers
        })
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
});



// Get my Byers who bought my product
app.get('/myBuyers', verifyJWT, async (req, res) => {
    try {
        const email = req.query.email;
        const decodedEmail = req.decode.email;

        if (email !== decodedEmail) {
            return res.status(403).send({ message: "Forbidden access" });
        }

        const query = { sellerEmail: email };
        const result = await Bookings.find(query).toArray();
        res.send({
            success: true,
            message: 'Successfully got all the buyers',
            data: result
        })
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})


// Get my products me added which are unsold
app.get('/myProducts', async (req, res) => {
    try {
        const email = req.query.email;
        const query = { sellerEmail: email };
        const result = await Products.find(query).toArray();
        res.send({
            success: true,
            message: 'Successfully got the products',
            data: result
        })
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})



// Delete my products
app.delete('/myProducts/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const deleted = await Products.deleteOne(query);

        if (deleted.deletedCount) {
            res.send({
                success: true,
                message: 'Successfully delete the item',
                data: deleted
            })
        } else {
            res.send({
                success: false,
                message: 'could not delete the item'
            })
        }
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})



app.post('/create-payment-intent', verifyJWT, async (req, res) => {
    try {
        const email = req.query.email;
        const decodedEmail = req.decode.email;

        if (email !== decodedEmail) {
            return res.status(403).send({ message: 'forbidden access' });
        }

        const price = req.body.price;
        const amount = parseFloat(price) * 100;

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            payment_method_types: ['card']
        })
        res.send({
            clientSecret: paymentIntent.client_secret
        })
    } catch (error) {
        console.log(error)
    }
});



// get wish list
app.get('/wishlist', verifyJWT, async (req, res) => {
    try {
        const email = req.query.email;
        const decodedEmail = req.decode.email;

        if (email !== decodedEmail) {
            res.status(403).send({ message: 'forbidden access' });
        } else {
            const query = { customerEmail: email };
            const wishList = await WishList.find(query).toArray();
            res.send({
                success: true,
                message: 'Successfully find wishlist',
                data: wishList
            })
        }
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})



// Add to wishlist
app.post('/wishlist', async (req, res) => {
    try {
        const product = req.body;
        const result = await WishList.insertOne(product);
        if (result.insertedId) {
            res.send({
                success: true,
                message: 'successfully insert the product',
                data: result
            })
        } else {
            res.send({
                success: false,
                message: 'could not insert the product'
            })
        }
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})



// Card payment
app.post('/payment', verifyJWT, async (req, res) => {
    try {
        const payment = req.body;
        const bookingId = payment.bookingId;

        if (bookingId) {
            const query = { _id: ObjectId(payment.bookingId) };
            const updatedDoc = {
                $set: {
                    status: 'paid'
                }
            };
            const updateBooking = await Bookings.updateOne(query, updatedDoc);
        };

        const filter = { _id: ObjectId(payment.productId) }
        const updateProductStatus = {
            $set: {
                status: 'sold'
            }
        }


        const updatedProducts = await Products.updateOne(filter, updateProductStatus);
        const result = await Payments.insertOne(payment);

        if (result.insertedId) {
            res.send({
                success: true,
                message: 'Successfully insert the payments',
                data: result
            })
        }

    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
});


// Buy from wish list 
app.post('/wishListPayment', verifyJWT, async (req, res) => {
    try {
        const payment = req.body;
        const query = { _id: payment.productId }
        const filter = { _id: ObjectId(payment.productId) }
        const updatedDoc = {
            $set: {
                status: 'paid'
            }
        };

        const updateProductStatus = {
            $set: {
                status: 'sold'
            }
        }

        const updateWishList = await WishList.updateOne(query, updatedDoc);
        const updatedProducts = await Products.updateOne(filter, updateProductStatus);
        const result = await Payments.insertOne(payment);

        if (result.insertedId) {
            res.send({
                success: true,
                message: 'Successfully insert the payments',
                data: result
            })
        }

    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
});




// verify seller 
app.put('/verified/:id', async (req, res) => {
    try {
        const seller = req.body;
        const sellerId = req.params.id;

        const query = { _id: ObjectId(sellerId) }
        const options = { upsert: true }
        const updatedSellerDoc = {
            $set: {
                verified: true
            }
        }

        // update seller 
        const updatedSeller = await Users.updateOne(query, updatedSellerDoc, options);

        // update seller in the product collection 
        const filter = { sellerEmail: seller.email };
        const updatedProducts = {
            $set: {
                isVerified: true
            }
        }
        const updateSellerProducts = await Products.updateMany(filter, updatedProducts, { upsert: true });

        res.send({
            success: true,
            message: 'Successfully updated',
            data: { updatedSeller, updateSellerProducts }
        })
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
});



// Get advertise
app.get("/advertise", async (req, res) => {
    try {
        const advertise = await Advertise.find({}).toArray();
        res.send({
            success: true,
            message: 'successfully find advertise',
            data: advertise
        })
    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})


// Advertise product 
app.post('/advertise', async (req, res) => {
    try {
        const product = req.body;
        const result = await Advertise.insertOne(product);


        // update product status
        const id = product._id;
        const query = { _id: ObjectId(id) };
        const updatedDoc = {
            $set: {
                advertise: true
            }
        };

        const updateProduct = await Products.updateOne(query, updatedDoc);

        if (result.insertedId && updateProduct.modifiedCount) {
            res.send({
                success: true,
                message: 'Successfully inset the product',
                data: result
            })
        } else {
            res.send({
                success: false,
                message: 'Could not insert the product'
            })
        }
    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})


// Reviews routes
// Get reviews
app.get('/reviews/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = { productId: id };
        const reviews = await Reviews.find(query).toArray();

        res.send({
            success: true,
            message: 'Successfully inset the product',
            data: reviews
        })
    } catch (error) {
        res.send({
            success: false,
            error: error.message
        })
    }
})


// Post reviews
app.post('/reviews', async (req, res) => {
    try {
        const review = req.body;
        const result = await Reviews.insertOne(review)

        if (result.insertedId) {
            res.send({
                success: true,
                message: 'Successfully inset the product',
                data: result
            })
        } else {
            res.send({
                success: false,
                message: 'Could not insert the review'
            })
        }

    } catch (error) {
        console.log(error);
        res.send({
            success: false,
            error: error.message
        })
    }
})


app.listen(port, () => console.log(`server side is running on port ${port}`))
