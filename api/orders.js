
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      full_name,
      phone,
      city,
      address,
      size_g,
      quantity
    } = req.body || {};

    const size = Number(size_g);
    const qty = Number(quantity);

    if (
      !full_name?.trim() ||
      !phone?.trim() ||
      !city?.trim() ||
      !address?.trim() ||
      ![850, 1200].includes(size) ||
      ![1, 2].includes(qty)
    ) {
      return res.status(400).json({
        error: "Please check the order information."
      });
    }

    const prices = {
      850: [200, 350],
      1200: [240, 420]
    };

    const total = prices[size][qty - 1];

    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !secretKey) {
      return res.status(500).json({
        error: "Server configuration is missing."
      });
    }

    const headers = {
      "Content-Type": "application/json",
      "apikey": secretKey,
      "Authorization": `Bearer ${secretKey}`
    };

    const customerResponse = await fetch(
      `${supabaseUrl}/rest/v1/customers?on_conflict=phone`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Prefer": "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify({
          full_name: full_name.trim(),
          phone: phone.trim(),
          city: city.trim(),
          address: address.trim()
        })
      }
    );

    if (!customerResponse.ok) {
      throw new Error("Could not save customer.");
    }

    const customers = await customerResponse.json();
    const customerId = customers[0]?.id;

    const productResponse = await fetch(
      `${supabaseUrl}/rest/v1/products?size_g=eq.${size}&is_active=eq.true&select=id`,
      { headers }
    );

    if (!productResponse.ok) {
      throw new Error("Could not find product.");
    }

    const products = await productResponse.json();

    if (!products.length || !customerId) {
      throw new Error("Customer or product not found.");
    }

    const orderResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          customer_id: customerId,
          product_id: products[0].id,
          quantity: qty,
          total_amount: total,
          status: "pending"
        })
      }
    );

    if (!orderResponse.ok) {
      throw new Error("Could not save order.");
    }

    return res.status(201).json({
      success: true,
      message: "Order received successfully."
    });

} catch (error) {
    console.error("Order API error:", error);

    return res.status(500).json({
      error: "Could not process the order."
   });
  }
};
