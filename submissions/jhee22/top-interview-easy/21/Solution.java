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
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        // 각 노드의 현재 위치 
        ListNode curr1 = list1; 
        ListNode curr2 = list2; 

        // 처음 시작이 0인 임시 node 만들기 
        ListNode tmp = new ListNode(0); 
        ListNode curr = tmp; 

        while (curr1 != null && curr2 != null) {
            if (curr1.val <= curr2.val){
                curr.next= curr1;
                curr1 = curr1.next;  
            } else {
                curr.next = curr2; 
                curr2 = curr2.next;
            }
            curr = curr.next; 
        }

        if (curr1 != null) {
            curr.next = curr1; 
        } else {
            curr.next = curr2; 
        }

        return tmp.next; 


    } 
}