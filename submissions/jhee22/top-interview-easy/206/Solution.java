/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode reverseList(ListNode head) {
        /*
            prev     curr
            ↓        ↓
            null     1 → 2 → 3 → 4 → 5 → null
         */

        ListNode prev = null;
        ListNode curr = head; 
        ListNode next; 

        while (curr != null) {
            next = curr.next; 
            curr.next = prev;
            prev = curr; 
            curr = next; 
        }

        return prev; 
        
    }
}