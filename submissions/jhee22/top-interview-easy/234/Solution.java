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
    public boolean isPalindrome(ListNode head) {
        ListNode fast = head; 
        ListNode slow = head;  

        // fast 가 끝까지 도달할 때, slow 가 중간에 도달 
        while (fast != null && fast.next != null) { 
            slow = slow.next; 
            fast = fast.next.next; 

        }

        // 뒤쪽 절반 뒤집기 <> 앞쪽 절반 비교 
        ListNode prev = null; 
        ListNode curr = slow; 

        while (curr != null){
            // 다음 노드를 일시 지정
            ListNode next = curr.next; 

            // 화살표 방향 뒤집기  
            curr.next = prev; 

            // 한칸씩 이동 
            prev = curr; 
            curr = next; 
        }

        ListNode left = head; 
        ListNode right = prev; 

        while (right != null) {
            if (left.val != right.val){
                return false;

            }
            left = left.next; 
            right = right.next; 

        }
        
        return true; 
    
    }
}