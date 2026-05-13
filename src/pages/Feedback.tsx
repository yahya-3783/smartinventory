import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Star, MessageSquarePlus, BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/formatters";

type FeedbackRow = {
  feedback_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  date: string;
  customer_name?: string;
};

type Customer = {
  customer_id: string;
  name: string;
};

const StarRating = ({ rating, interactive, onChange }: { rating: number; interactive?: boolean; onChange?: (r: number) => void }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        className={`h-5 w-5 ${s <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"} ${interactive ? "cursor-pointer hover:text-primary" : ""}`}
        onClick={() => interactive && onChange?.(s)}
      />
    ))}
  </div>
);

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterRating, setFilterRating] = useState<string>("all");

  const [customerId, setCustomerId] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: fb }, { data: cust }] = await Promise.all([
      supabase.from("feedback").select("*").order("date", { ascending: false }),
      supabase.from("customers").select("customer_id, name"),
    ]);

    const customerMap = new Map((cust || []).map((c) => [c.customer_id, c.name]));
    setFeedbacks(
      (fb || []).map((f) => ({ ...f, customer_name: customerMap.get(f.customer_id) || "Unknown" }))
    );
    setCustomers(cust || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    if (!customerId || rating === 0) {
      toast.error("Please select a customer and a rating");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      customer_id: customerId,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error("Failed to submit feedback: " + error.message); return; }
    toast.success("Feedback submitted successfully!");
    setCustomerId(""); setRating(0); setComment(""); setDialogOpen(false);
    fetchData();
  };

  const totalCount = feedbacks.length;
  const avgRating = totalCount ? (feedbacks.reduce((s, f) => s + f.rating, 0) / totalCount).toFixed(1) : "0";
  const starCounts = [1, 2, 3, 4, 5].map((s) => ({ star: s, count: feedbacks.filter((f) => f.rating === s).length }));

  const filtered = filterRating === "all" ? feedbacks : feedbacks.filter((f) => f.rating === Number(filterRating));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Feedback</h2>
          <p className="text-muted-foreground">Customer reviews and ratings</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><MessageSquarePlus className="mr-2 h-4 w-4" />Add Feedback</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Submit Feedback</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.customer_id} value={c.customer_id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rating</Label>
                <StarRating rating={rating} interactive onChange={setRating} />
              </div>
              <div>
                <Label>Comment</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment..." />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Average Rating</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-foreground">{avgRating}</span>
              <Star className="h-4 w-4 fill-primary text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Reviews</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-2xl font-bold text-foreground">{totalCount}</span>
          </CardContent>
        </Card>
        {starCounts.map(({ star, count }) => (
          <Card key={star}>
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{star}★</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-2xl font-bold text-foreground">{count}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />All Feedback</CardTitle>
          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              {[5, 4, 3, 2, 1].map((s) => (
                <SelectItem key={s} value={String(s)}>{s} Star{s > 1 ? "s" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No feedback found. Submit the first review!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.feedback_id}>
                    <TableCell className="font-medium">{f.customer_name}</TableCell>
                    <TableCell><StarRating rating={f.rating} /></TableCell>
                    <TableCell className="max-w-xs truncate">{f.comment || <span className="text-muted-foreground italic">No comment</span>}</TableCell>
                    <TableCell>{formatDate(f.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Feedback;
